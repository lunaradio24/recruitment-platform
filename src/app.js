import express from 'express';
import cookieParser from 'cookie-parser';
import AuthRouter from './routers/auth.router.js';
import UsersRouter from './routers/users.router.js';
import ResumesRouter from './routers/resumes.router.js';

const app = express();
const PORT = 3020;

app.use(express.json());
app.use(cookieParser());

app.use('/', [AuthRouter, UsersRouter, ResumesRouter]);

app.listen(PORT, () => {
  console.log(PORT, '포트로 서버가 열렸어요!');
});
