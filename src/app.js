import express from 'express';
import AuthRouter from './routers/auth.router.js';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = 3020;

app.use(express.json());
app.use(cookieParser());

app.use('/', [AuthRouter]);

app.listen(PORT, () => {
  console.log(PORT, '포트로 서버가 열렸어요!');
});
