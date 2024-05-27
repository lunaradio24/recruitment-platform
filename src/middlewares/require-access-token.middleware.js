import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '../utils/prisma.util.js';
import { CustomError } from '../utils/custom-error.util.js';
dotenv.config();

// ### AccessToken 인증 Middleware - 공통 된 AccessToken 인증 과정을 처리합니다.
const requireAccessToken = async (req, res, next) => {
  try {
    // 1. 요청 정보
    const { accessToken: authorization } = req.cookies; // 방법(1) cookie 사용
    // const authorization = req.headers['authorization']; // 방법(2) Authorization Header 사용

    // 2. 유효성 검증 및 에러 처리
    //  - Authorization 또는 AccessToken이 없는 경우
    if (!authorization) throw new CustomError(401, '인증 정보가 없습니다.');

    //  - JWT 표준 인증 형태와 일치하지 않는 경우
    const [tokenType, token] = authorization.split(' '); // %20 === ' '
    if (tokenType !== 'Bearer') throw new CustomError(401, '지원하지 않는 인증 방식입니다.');

    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY) ?? null;

    // 3. 비즈니스 로직(데이터 처리)
    //  - Payload에 담긴 사용자 ID를 이용하여 사용자 정보를 조회합니다.
    const { authId } = payload;
    const user = await prisma.users.findUnique({ where: { authId: authId } });

    //  - Payload에 담긴 사용자 ID와 일치하는 사용자가 없는 경우
    if (!user) {
      res.clearCookie('accessToken');
      throw new CustomError(401, '인증 정보와 일치하는 사용자가 없습니다.');
    }

    // 4. 반환 정보
    //  - 조회 된 사용자 정보를 `req.user`에 담고, 다음 동작을 진행합니다.
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export default requireAccessToken;
