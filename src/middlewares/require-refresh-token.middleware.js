import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '../utils/prisma.util.js';
dotenv.config();

const requireRefreshToken = async (req, res, next) => {
  try {
    // 1. 요청 정보
    // - RefreshToken을 Request Header의 Authorization 값(`req.headers.authorization`)으로 전달 받으며,
    // JWT 표준 인증 형태(`Authorization: Bearer {{ RefreshToken }}`)에 맞아야 합니다.
    const { refreshToken } = req.cookies;

    // 2. 유효성 검증 및 에러 처리
    // - RefreshToken이 없는 경우 - “인증 정보가 없습니다.”
    if (!refreshToken) {
      return res.status(401).json({ errorMessage: '인증 정보가 없습니다.' });
    }

    // - JWT 표준 인증 형태와 일치하지 않는 경우 - “지원하지 않는 인증 방식입니다.”
    const [tokenType, token] = refreshToken.split(' '); // %20 === ' '
    if (tokenType !== 'Bearer') {
      return res
        .status(401)
        .json({ errorMessage: '지원하지 않는 인증 방식입니다.' });
    }

    // 3. 비즈니스 로직(데이터 처리)
    // - Payload에 담긴 사용자 ID를 이용하여 사용자 정보를 조회합니다.
    const payload =
      jwt.verify(token, process.env.REFRESH_TOKEN_SECRET_KEY) ?? null;
    const { id } = payload;
    const user = await prisma.users.findUnique({
      where: { userId: id },
    });

    // - Payload에 담긴 사용자 ID와 일치하는 사용자가 없는 경우 - “인증 정보와 일치하는 사용자가 없습니다.”
    if (!user) {
      res.clearCookie('refreshToken');
      throw new Error('인증 정보와 일치하는 사용자가 없습니다.');
    }

    // 4. 반환 정보
    // - 조회 된 사용자 정보를 `req.user`에 담고, 다음 동작을 진행합니다.
    req.user = user;
    next();
  } catch (error) {
    switch (error.name) {
      case 'TokenExpiredError': // 토큰 만료
        return res.status(401).json({ message: '인증 정보가 만료되었습니다.' });
      case 'JsonWebTokenError': // 토큰이 검증에 실패
        return res.status(401).json({ message: '폐기된 인증 정보입니다.' });
      default:
        return res
          .status(401)
          .json({ message: error.message ?? '인증 정보가 유효하지 않습니다.' });
    }
  }
};
