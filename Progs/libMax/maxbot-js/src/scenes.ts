import type { Context } from './context';
import type { DispatchRouter } from './dispatcher-router';
import type { FSMData } from './fsm';
import { filters } from './filters';

const SCENE_STATE_PREFIX = '__scene:';

export type SceneHandler = (ctx: Context, scene: SceneSession) => Promise<void> | void;

export interface SceneOptions {
  enter?: SceneHandler;
  leave?: SceneHandler;
}

export interface SceneEnterOptions {
  step?: number;
  data?: FSMData;
  resetData?: boolean;
}

interface BaseSceneDefinition extends SceneOptions {
  kind: 'scene' | 'wizard';
}

interface PlainSceneDefinition extends BaseSceneDefinition {
  kind: 'scene';
  handler: SceneHandler;
}

interface WizardSceneDefinition extends BaseSceneDefinition {
  kind: 'wizard';
  steps: SceneHandler[];
}

type SceneDefinition = PlainSceneDefinition | WizardSceneDefinition;

interface ParsedState {
  sceneID: string;
  step: number;
}

export class SceneSession {
  readonly id: string;
  readonly step: number;
  private readonly ctx: Context;

  constructor(ctx: Context, id: string, step: number) {
    this.ctx = ctx;
    this.id = id;
    this.step = step;
  }

  async next(): Promise<void> {
    await this.goto(this.step + 1);
  }

  async back(): Promise<void> {
    await this.goto(Math.max(0, this.step - 1));
  }

  async goto(step: number): Promise<void> {
    await this.ctx.setState(encodeSceneState(this.id, Math.max(0, step)));
  }

  async leave(): Promise<void> {
    await this.ctx.clearState();
  }

  async getData<TData extends FSMData = FSMData>(): Promise<TData> {
    return await this.ctx.getData<TData>();
  }

  async setData(data: FSMData): Promise<void> {
    await this.ctx.setData(data);
  }

  async updateData(patch: FSMData): Promise<void> {
    await this.ctx.updateData(patch);
  }

  async clearData(): Promise<void> {
    await this.ctx.clearData();
  }
}

export class SceneManager {
  private readonly scenes = new Map<string, SceneDefinition>();
  private mounted = false;

  registerScene(id: string, handler: SceneHandler, options: SceneOptions = {}): void {
    const sceneID = normalizeSceneID(id);
    this.scenes.set(sceneID, { kind: 'scene', handler, ...options });
  }

  registerWizard(id: string, steps: SceneHandler[], options: SceneOptions = {}): void {
    const sceneID = normalizeSceneID(id);
    this.scenes.set(sceneID, { kind: 'wizard', steps, ...options });
  }

  mount(target: DispatchRouterMountTarget): void {
    if (this.mounted) return;
    this.mounted = true;
    target.anyFirst([filters.stateStartsWith(SCENE_STATE_PREFIX)], async (ctx) => {
      await this.handle(ctx);
    });
  }

  async enter(ctx: Context, id: string, stepOrOptions: number | SceneEnterOptions = 0): Promise<void> {
    const sceneID = normalizeSceneID(id);
    const target = this.scenes.get(sceneID);
    if (!target) throw new Error(`scene not found: ${sceneID}`);
    const options = normalizeEnterOptions(stepOrOptions);

    const previous = parseSceneState(await ctx.getState());
    if (previous) {
      const prevScene = this.scenes.get(previous.sceneID);
      if (prevScene?.leave) {
        await prevScene.leave(ctx, new SceneSession(ctx, previous.sceneID, previous.step));
      }
    }

    if (options.resetData) {
      await ctx.clearData();
    }
    if (options.data) {
      await ctx.updateData(options.data);
    }

    await ctx.setState(encodeSceneState(sceneID, options.step));
    if (target.enter) {
      await target.enter(ctx, new SceneSession(ctx, sceneID, Math.max(0, options.step)));
    }
  }

  async leave(ctx: Context): Promise<void> {
    const current = parseSceneState(await ctx.getState());
    if (!current) return;
    const target = this.scenes.get(current.sceneID);
    if (target?.leave) {
      await target.leave(ctx, new SceneSession(ctx, current.sceneID, current.step));
    }
    await ctx.clearState();
  }

  async current(ctx: Context): Promise<{ id: string; step: number } | null> {
    const parsed = parseSceneState(await ctx.getState());
    if (!parsed) return null;
    return { id: parsed.sceneID, step: parsed.step };
  }

  async handle(ctx: Context): Promise<boolean> {
    const parsed = parseSceneState(await ctx.getState());
    if (!parsed) return false;

    const target = this.scenes.get(parsed.sceneID);
    if (!target) {
      await ctx.clearState();
      return false;
    }

    const session = new SceneSession(ctx, parsed.sceneID, parsed.step);
    if (target.kind === 'scene') {
      await target.handler(ctx, session);
      return true;
    }

    const stepHandler = target.steps[parsed.step];
    if (!stepHandler) {
      await this.leave(ctx);
      return false;
    }

    await stepHandler(ctx, session);
    return true;
  }
}

type DispatchRouterMountTarget = Pick<DispatchRouter, 'anyFirst'>;

function normalizeSceneID(id: string): string {
  return id.trim().toLowerCase();
}

function encodeSceneState(sceneID: string, step: number): string {
  return `${SCENE_STATE_PREFIX}${sceneID}:${Math.max(0, step)}`;
}

function parseSceneState(raw: string | undefined): ParsedState | null {
  if (!raw?.startsWith(SCENE_STATE_PREFIX)) return null;
  const payload = raw.slice(SCENE_STATE_PREFIX.length);
  const [sceneIDRaw, stepRaw] = payload.split(':', 2);
  const sceneID = sceneIDRaw?.trim().toLowerCase();
  if (!sceneID) return null;

  const parsed = Number(stepRaw ?? '0');
  return {
    sceneID,
    step: Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
  };
}

function normalizeEnterOptions(stepOrOptions: number | SceneEnterOptions): Required<Pick<SceneEnterOptions, 'step' | 'resetData'>> & Pick<SceneEnterOptions, 'data'> {
  if (typeof stepOrOptions === 'number') {
    return { step: Math.max(0, stepOrOptions), resetData: false };
  }
  return {
    step: Math.max(0, stepOrOptions.step ?? 0),
    data: stepOrOptions.data,
    resetData: stepOrOptions.resetData ?? false
  };
}
