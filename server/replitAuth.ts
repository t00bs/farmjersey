import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const domains = process.env.REPLIT_DOMAINS!.split(",");
  
  for (const domain of domains) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  // Add localhost strategy for development
  if (process.env.NODE_ENV === "development") {
    const localhostStrategy = new Strategy(
      {
        name: `replitauth:localhost`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domains[0]}/api/callback`,
      },
      verify,
    );
    passport.use(localhostStrategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", async (req: any, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.redirect("/api/login");
      }

      // Check if there's an invitation token in the session
      const invitationToken = req.session.invitationToken;
      
      if (invitationToken) {
        try {
          const { storage } = await import("./storage");
          const invitation = await storage.getInvitationByToken(invitationToken);
          
          if (!invitation || invitation.used || new Date() > new Date(invitation.expiresAt)) {
            // Invalid or expired invitation
            return res.send("This invitation is invalid or has expired. Please contact an administrator.");
          }

          // Check if the logged in email matches the invitation email
          const userEmail = user.claims?.email;
          if (userEmail !== invitation.email) {
            return res.send(`This invitation was sent to ${invitation.email}. Please log in with that account.`);
          }

          // Mark invitation as used
          await storage.markInvitationAsUsed(invitation.id);
          
          // Clear the token from session
          delete req.session.invitationToken;
          
          // Log the user in
          req.logIn(user, (loginErr) => {
            if (loginErr) {
              return next(loginErr);
            }
            return res.redirect("/");
          });
        } catch (error) {
          console.error("Error processing invitation:", error);
          return res.status(500).send("Error processing invitation");
        }
      } else {
        // No invitation token - check if user is admin or has existing invitation
        const userEmail = user.claims?.email;
        const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((email: string) => email.trim()) || [];
        
        console.log(`[AUTH] Checking admin access for ${userEmail}. Admin emails:`, adminEmails);
        
        // Allow admins without invitation
        if (adminEmails.includes(userEmail)) {
          console.log(`[AUTH] Admin access granted for ${userEmail}`);
          req.logIn(user, (loginErr) => {
            if (loginErr) {
              return next(loginErr);
            }
            return res.redirect("/");
          });
        } else {
          console.log(`[AUTH] ${userEmail} is not an admin. Checking for invitation...`);
          // Non-admin user without invitation token - check if they have a used invitation
          try {
            const { storage } = await import("./storage");
            const invitation = await storage.getInvitationByEmail(userEmail);
            
            if (invitation && invitation.used) {
              // User has previously used an invitation, allow login
              req.logIn(user, (loginErr) => {
                if (loginErr) {
                  return next(loginErr);
                }
                return res.redirect("/");
              });
            } else {
              // User needs an invitation
              return res.send("You need an invitation to access this system. Please contact an administrator.");
            }
          } catch (error) {
            console.error("Error checking user invitation:", error);
            return res.status(500).send("Error checking access");
          }
        }
      }
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
