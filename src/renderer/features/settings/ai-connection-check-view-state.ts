import {
  UNKNOWN_AI_CONNECTION_CHECK_DATA,
  type AiConnectionCheckData,
  type ContractResponse,
} from '../../../shared/contracts';

export type AiConnectionCheckViewState = Readonly<{
  pending: boolean;
  data: AiConnectionCheckData;
  failed: boolean;
}>;

export type AiConnectionCheckInvoker =
  () => Promise<ContractResponse<'ai:check-connection'>>;

const INITIAL_STATE: AiConnectionCheckViewState = Object.freeze({
  pending: false,
  data: UNKNOWN_AI_CONNECTION_CHECK_DATA,
  failed: false,
});

export class AiConnectionCheckViewController {
  private state = INITIAL_STATE;
  private active = true;
  private requestInFlight = false;
  private viewEpoch = 0;

  constructor(
    private readonly invoke: AiConnectionCheckInvoker,
    private readonly publish: (state: AiConnectionCheckViewState) => void,
  ) {}

  read(): AiConnectionCheckViewState {
    return this.state;
  }

  check(): Promise<void> {
    if (!this.active || this.requestInFlight) return Promise.resolve();
    this.requestInFlight = true;
    const epoch = ++this.viewEpoch;
    this.publishState({
      pending: true,
      data: UNKNOWN_AI_CONNECTION_CHECK_DATA,
      failed: false,
    });
    return this.complete(epoch);
  }

  dispose(): void {
    this.active = false;
    this.viewEpoch += 1;
  }

  private async complete(epoch: number): Promise<void> {
    let response: ContractResponse<'ai:check-connection'> | null = null;
    try {
      response = await this.invoke();
    } catch {
      response = null;
    }
    if (!this.active || epoch !== this.viewEpoch) return;
    this.requestInFlight = false;
    this.publishState(response?.ok
      ? { pending: false, data: response.data, failed: false }
      : { pending: false, data: UNKNOWN_AI_CONNECTION_CHECK_DATA, failed: true });
  }

  private publishState(state: AiConnectionCheckViewState): void {
    this.state = Object.freeze({ ...state });
    this.publish(this.state);
  }
}
