import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
  try {
    const idToken = "bkash:idToken";
    const refreshToken = "bkash:refreshToken";

    let bkashIdToken = await redisClient.get(idToken);
    const bkashIdTokenTTL = await redisClient.ttl(idToken);
    const bkashRefreshToken = await redisClient.get(refreshToken);
    const bkashRefreshTokenTTL = await redisClient.ttl(refreshToken);

    console.log({
        bkashIdToken, bkashIdTokenTTL, bkashRefreshToken, bkashRefreshTokenTTL
    })

    if ((bkashIdTokenTTL <= 600 || !bkashIdToken) && bkashRefreshToken && bkashRefreshTokenTTL > 600) {
      const bkashRefreshTokenResponse = await fetch(
        `${config.bkash_base_url}tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },
          body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        },
      );

      if (!bkashRefreshTokenResponse) {
        throw new Error("Bkash refresh token is invalid");
      }

      const bkashRefreshTokenResult = await bkashRefreshTokenResponse.json();

      bkashIdToken = bkashRefreshTokenResult.id_token as string;

      await redisClient.set(idToken, bkashIdToken, {
        expiration: {
          type: "EX",
          value: 3600, // 1 hour in seconds
        },
      });

      return bkashIdToken;
    }

    if (bkashIdTokenTTL > 600) {
      return bkashIdToken;
    }

    const response = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },
        body: JSON.stringify({
          app_key: config.bkash_app_key,
          app_secret: config.bkash_app_secret,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get bKash ID token: ${response.statusText}`);
    }

    const result = await response.json();

    await redisClient.set(idToken, result.id_token, {
      expiration: {
        type: "EX",
        value: 3600, // 1 hour in seconds
      },
    });

    await redisClient.set(refreshToken, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 3600 * 24 * 28, // 28 days
      },
    });

    bkashIdToken = result.id_token;

    return bkashIdToken;
  } catch (error: any) {
    throw new Error(`Failed to get bKash ID token: ${error.message}`);
  }
};
