import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Email Regular expression
export const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;

// Access Token을 생성하는 함수
export const createAccessToken = (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    process.env.ACCESS_TOKEN_SECRET_KEY,
    { expiresIn: '12h' },
  );
  return accessToken;
};

// Refresh Token을 생성하는 함수
export const createRefreshToken = (userId) => {
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET_KEY,
    { expiresIn: '7s' },
  );
  return refreshToken;
};
