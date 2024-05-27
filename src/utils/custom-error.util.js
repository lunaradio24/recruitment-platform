// Customized Error
export class CustomError extends Error {
  constructor(code, message) {
    // 부모 클래스(Error)의 생성자 호출
    super(message);
    // 에러 객체의 속성 설정
    this.code = code;
  }
}
