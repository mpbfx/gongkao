export class BadRequestError extends Error {
  constructor(message = "请求参数错误", public details: unknown = null) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "资源不存在") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message = "状态冲突") {
    super(message);
    this.name = "ConflictError";
  }
}

export class MembershipRequiredError extends Error {
  constructor(message = "该内容需要会员权限") {
    super(message);
    this.name = "MembershipRequiredError";
  }
}

export class BusinessError extends Error {
  constructor(message = "业务规则不满足", public details: unknown = null) {
    super(message);
    this.name = "BusinessError";
  }
}

export class ServiceUnavailableError extends Error {
  constructor(message = "服务暂时不可用", public details: unknown = null) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}
