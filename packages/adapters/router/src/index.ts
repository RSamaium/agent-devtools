import { getInstrumentation, serialize, type CaptureAdapter, type RuntimeContext } from '@agent-devtools/runtime';
import type { RouteSnapshot, SerializedValue, StandardCaptureSnapshot } from '@agent-devtools/protocol';
interface RouteConfigLike { path?: string; outlet?: string; component?: object; loadChildren?: unknown; loadComponent?: unknown; children?: RouteConfigLike[]; data?: Record<string, unknown> }
interface RouterLike { url?: string; config?: RouteConfigLike[]; navigated?: boolean; currentNavigation?: unknown }
interface DebugApi { getDirectives?(element: Element): object[]; getComponent?(element: Element): object | null }
export class RouterAdapter implements CaptureAdapter<StandardCaptureSnapshot> {
  readonly name = 'router'; readonly priority = 25;
  isAvailable(context: RuntimeContext) { return [...(getInstrumentation(context.window)?.records.values() ?? [])].some(item => item.kind === 'service' && item.name === 'Router') || typeof (context.window as unknown as { ng?: DebugApi }).ng?.getDirectives === 'function'; }
  capture(snapshot: StandardCaptureSnapshot, context: RuntimeContext): void {
    const record = [...(getInstrumentation(context.window)?.records.values() ?? [])].find(item => item.kind === 'service' && item.name === 'Router');
    const router = record?.value as RouterLike | undefined ?? discoverRouter(context);
    if (!router) return;
    const convert = (route: RouteConfigLike): RouteSnapshot => {
      const componentName = typeof route.component === 'function' ? route.component.name.replace(/^_/, '') : undefined;
      const component = componentName ? snapshot.components.find(item => item.name === componentName)?.ref : undefined;
      const params = matchRoute(route.path ?? '', router.url ?? context.window.location.pathname);
      return { ref: context.refs.ref(route, 'route'), path: route.path ?? '', outlet: route.outlet ?? 'primary', active: params !== undefined, lazy: !!route.loadChildren || !!route.loadComponent, ...(component ? { component } : {}), children: (route.children ?? []).map(convert), params: params ?? {}, queryParams: Object.fromEntries(new URL(context.window.location.href).searchParams.entries()), ...(context.window.location.hash ? { fragment: context.window.location.hash.slice(1) } : {}), data: serialize(route.data ?? {}, context.options.budget).value as Record<string, SerializedValue> };
    };
    const navigationEvents = getInstrumentation(context.window)?.events.filter(item => item.type === 'navigation') ?? [];
    const events = navigationEvents.slice(-20).map((event, index) => {
      const value = event.value && typeof event.value === 'object' ? event.value as Record<string, unknown> : {};
      return { id: index + 1, type: typeof value['type'] === 'string' ? value['type'] : 'RouterEvent', ...(typeof value['url'] === 'string' ? { url: value['url'] } : {}), timestamp: event.timestamp, ...(typeof value['error'] === 'string' ? { error: value['error'] } : {}) };
    });
    let currentNavigation = router.currentNavigation; try { if (typeof currentNavigation === 'function') currentNavigation = (currentNavigation as () => unknown)(); } catch { currentNavigation = undefined; }
    snapshot.router = { activeUrl: router.url ?? context.window.location.pathname, roots: (router.config ?? []).map(convert), events, navigationInProgress: !!currentNavigation };
  }
}
export const routerAdapter = () => new RouterAdapter();

const discoverRouter = (context: RuntimeContext): RouterLike | undefined => {
  const api = (context.window as unknown as { ng?: DebugApi }).ng;
  if (!api) return undefined;
  const inspected = new WeakSet<object>();
  for (const element of context.document.querySelectorAll('*')) {
    let instances: object[] = [];
    try { const component = api.getComponent?.(element); instances = [...(api.getDirectives?.(element) ?? []), ...(component ? [component] : [])]; } catch { continue; }
    for (const instance of instances) for (const candidate of ownObjects(instance)) {
      if (inspected.has(candidate)) continue; inspected.add(candidate);
      const value = candidate as RouterLike & { navigateByUrl?: unknown };
      if (Array.isArray(value.config) && typeof value.url === 'string' && typeof value.navigateByUrl === 'function') return value;
    }
  }
  return undefined;
};

const ownObjects = (value: object): object[] => [value, ...Object.keys(value).flatMap(key => {
  try { const descriptor = Object.getOwnPropertyDescriptor(value, key); const item = descriptor && 'value' in descriptor ? descriptor.value as unknown : undefined; return item && typeof item === 'object' ? [item] : []; }
  catch { return []; }
})];

const matchRoute = (path: string, url: string): Record<string, SerializedValue> | undefined => {
  const routeSegments = path.split('/').filter(Boolean); const urlSegments = url.split(/[?#]/)[0]?.split('/').filter(Boolean) ?? [];
  if (routeSegments.length !== urlSegments.length) return undefined;
  const params: Record<string, SerializedValue> = {};
  for (let index = 0; index < routeSegments.length; index++) {
    const route = routeSegments[index]!; const actual = urlSegments[index]!;
    if (route.startsWith(':')) params[route.slice(1)] = decodeURIComponent(actual);
    else if (route !== actual) return undefined;
  }
  return params;
};
