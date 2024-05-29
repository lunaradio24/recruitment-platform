import 'dotenv/config';
import jwt from 'jsonwebtoken';

// Access Token을 생성하는 함수
export const createAccessToken = (authId) => {
  // - Payload에 `사용자 ID`를 포함하고, 유효기한이 `12시간`
  const accessToken = jwt.sign({ authId: authId }, process.env.ACCESS_TOKEN_SECRET_KEY, { expiresIn: '12h' });
  return accessToken;
};

// Refresh Token을 생성하는 함수
export const createRefreshToken = (authId) => {
  // - Payload에 `사용자 ID`를 포함하고, 유효기한이 `7일`
  const refreshToken = jwt.sign({ authId: authId }, process.env.REFRESH_TOKEN_SECRET_KEY, { expiresIn: '7d' });
  return refreshToken;
};
