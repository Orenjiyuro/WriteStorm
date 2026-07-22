export type CodexUtilityTransport<Request, Execution> = {
  execute(request: Request): Execution;
};
