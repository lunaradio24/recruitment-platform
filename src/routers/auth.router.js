import express from 'express';
import { prisma } from '../utils/prisma.util.js';
import bcrypt from 'bcrypt';

const router = express.Router();

/*****     회원가입 API     *****/
router.post('/auth/sign-up', async (req, res, next) => {
  // 1. 요청 정보 - 이메일, 비밀번호, 비밀번호 확인, 이름을 Request Body(`req.body`)로 전달 받습니다.
  const { email, password, passwordConfirm, name } = req.body;

  // 2. 유효성 검증 및 에러 처리
  // - 회원 정보 중 하나라도 빠진 경우 - “OOO을 입력해 주세요.”
  if (!email) {
    return res.status(400).json({ errorMessage: 'email을 입력해 주세요.' });
  }
  if (!password) {
    return res.status(400).json({ errorMessage: '비밀번호을 입력해 주세요.' });
  }
  if (!passwordConfirm) {
    return res
      .status(400)
      .json({ errorMessage: '비밀번호 확인을 입력해 주세요.' });
  }
  if (!name) {
    return res.status(400).json({ errorMessage: '이름을 입력해 주세요.' });
  }

  // - 이메일 형식에 맞지 않는 경우 - “이메일 형식이 올바르지 않습니다.”
  const email_regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;
  if (!email_regex.test(email)) {
    return res
      .status(400)
      .json({ errorMessage: '이메일 형식이 올바르지 않습니다.' });
  }

  // - 이메일이 중복되는 경우 - “이미 가입 된 사용자입니다.”
  const isExistUser = await prisma.users.findUnique({
    where: { email: email },
  });
  if (isExistUser) {
    return res.status(400).json({ errorMessage: '이미 가입된 사용자입니다.' });
  }

  //     - 비밀번호가 6자리 미만인 경우 - “비밀번호는 6자리 이상이어야 합니다.”
  if (password.length < 6) {
    return res
      .status(400)
      .json({ errorMessage: '비밀번호는 6자리 이상이어야 합니다.' });
  }

  //     - 비밀번호와 비밀번호 확인이 일치하지 않는 경우 - “입력한 두 비밀번호가 일치하지 않습니다.”
  if (password !== passwordConfirm) {
    return res
      .status(400)
      .json({ errorMessage: '입력한 두 비밀번호가 일치하지 않습니다.' });
  }

  // 3. 비즈니스 로직(데이터 처리)
  //  - 사용자 ID, 역할, 생성일시, 수정일시는 자동 생성됩니다.
  //  - 역할의 종류는 다음과 같으며, 기본 값은 `APPLICANT` 입니다. (지원자 `APPLICANT`, 채용 담당자 `RECRUITER`)
  //  - 보안을 위해 비밀번호는 평문(Plain Text)으로 저장하지 않고 Hash 된 값을 저장합니다.
  // Hashing Password
  const saltRounds = 10; // salting을 몇 번 반복할 지
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = await prisma.users.create({
    data: {
      email: email,
      password: hashedPassword,
    },
  });

  const userInfo = await prisma.userInfos.create({
    data: {
      UserId: user.userId,
      name: name,
    },
  });

  // 4. 반환 정보
  //     - 사용자 ID, 이메일, 이름, 역할, 생성일시, 수정일시를 반환합니다.
  return res.status(201).json({
    message: '회원가입에 성공했습니다.',
    data: {
      userId: user.userId,
      email: email,
      name: name,
      role: userInfo.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

export default router;
