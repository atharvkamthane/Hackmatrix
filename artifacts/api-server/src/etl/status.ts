export interface EtlStatusSnapshot {
  running: boolean;
  mode: "CHANGE_STREAM" | "POLLING_FALLBACK";
  status: "RUNNING" | "IDLE" | "RECOVERING" | "ERROR" | "STOPPED";
  lastCheckpointedAt: string | null;
  lastEventTimestamp: string | null;
  lagSeconds: number;
  eventsProcessed: number;
  eventsSkipped: number;
  eventsFailed: number;
  lastErrorCategory: string | null;
}

class EtlStatusTracker {
  private running = false;
  private mode: "CHANGE_STREAM" | "POLLING_FALLBACK" = "POLLING_FALLBACK";
  private status: "RUNNING" | "IDLE" | "RECOVERING" | "ERROR" | "STOPPED" = "STOPPED";
  private lastCheckpointedAt: Date | null = null;
  private lastEventTimestamp: Date | null = null;
  private eventsProcessed = 0;
  private eventsSkipped = 0;
  private eventsFailed = 0;
  private lastErrorCategory: string | null = null;

  public setRunning(running: boolean, mode: "CHANGE_STREAM" | "POLLING_FALLBACK"): void {
    this.running = running;
    this.mode = mode;
    this.status = running ? "RUNNING" : "STOPPED";
  }

  public setStatus(status: "RUNNING" | "IDLE" | "RECOVERING" | "ERROR" | "STOPPED"): void {
    this.status = status;
  }

  public recordSuccess(eventTimestamp = new Date()): void {
    this.lastCheckpointedAt = new Date();
    this.lastEventTimestamp = eventTimestamp;
    this.eventsProcessed += 1;
    this.lastErrorCategory = null;
    this.status = "RUNNING";
  }

  public recordSkip(): void {
    this.eventsSkipped += 1;
  }

  public recordFailure(errorCategory: string): void {
    this.eventsFailed += 1;
    this.lastErrorCategory = errorCategory;
    this.status = "ERROR";
  }

  public syncFromCheckpoint(checkpoint: {
    lastCheckpointedAt?: Date | null;
    lastEventTimestamp?: Date | null;
    eventsProcessed?: number;
    eventsSkipped?: number;
    eventsFailed?: number;
    mode?: "CHANGE_STREAM" | "POLLING_FALLBACK";
    status?: "RUNNING" | "IDLE" | "RECOVERING" | "ERROR" | "STOPPED";
    lastErrorCategory?: string | null;
  }): void {
    if (checkpoint.lastCheckpointedAt) this.lastCheckpointedAt = checkpoint.lastCheckpointedAt;
    if (checkpoint.lastEventTimestamp) this.lastEventTimestamp = checkpoint.lastEventTimestamp;
    if (typeof checkpoint.eventsProcessed === "number") this.eventsProcessed = checkpoint.eventsProcessed;
    if (typeof checkpoint.eventsSkipped === "number") this.eventsSkipped = checkpoint.eventsSkipped;
    if (typeof checkpoint.eventsFailed === "number") this.eventsFailed = checkpoint.eventsFailed;
    if (checkpoint.mode) this.mode = checkpoint.mode;
    if (checkpoint.lastErrorCategory) this.lastErrorCategory = checkpoint.lastErrorCategory;
  }

  public getSnapshot(): EtlStatusSnapshot {
    const now = Date.now();
    const lagMs = this.lastEventTimestamp ? Math.max(0, now - this.lastEventTimestamp.getTime()) : 0;
    return {
      running: this.running,
      mode: this.mode,
      status: this.status,
      lastCheckpointedAt: this.lastCheckpointedAt?.toISOString() ?? null,
      lastEventTimestamp: this.lastEventTimestamp?.toISOString() ?? null,
      lagSeconds: Math.floor(lagMs / 1000),
      eventsProcessed: this.eventsProcessed,
      eventsSkipped: this.eventsSkipped,
      eventsFailed: this.eventsFailed,
      lastErrorCategory: this.lastErrorCategory,
    };
  }
}

export const etlStatusTracker = new EtlStatusTracker();
