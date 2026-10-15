/**
 * PREVIEW TOUR — runs tour actions inside the preview pane's guest page, so a
 * tour can walk through ANY web app open in the in-app browser, not just
 * Vetri itself.
 *
 * The guest page is out-of-process; nothing here can touch its DOM directly.
 * Instead the first action injects a self-contained bundle over
 * `executeJavaScript` — the vendored driver.js IIFE, its stylesheet, and the
 * same engine/collector SOURCE the app surface runs (see lib/tour/engine.ts's
 * self-containment contract) — parked on window globals so subsequent actions
 * reuse the live driver instance. Injection is idempotent and vanishes with
 * the page (a navigation resets the tour, which is the right behavior).
 *
 * Dynamic-imported by run-tour.ts so the raw driver.js payload stays out of
 * the boot path.
 */

import driverCss from 'driver.js/dist/driver.css?raw'
import driverIife from 'driver.js/dist/driver.js.iife.js?raw'

import { collectTourTargets } from '@/lib/tour/collect-targets'
import { runTourEngine, type TourAction, type TourResult } from '@/lib/tour/engine'
import type { PreviewOwner } from '@/store/preview-ownership'

import { activePreviewScriptRunner } from './preview-script-runner'

/** Build the idempotent inject-and-run script for one tour action. */
function buildTourScript(action: TourAction): string {
  return `(function () {
  var w = window;
  if (!w.__vetriTourEngine) {
    ${driverIife}
    w.__vetriTourHolder = {};
    w.__vetriTourCollect = (${collectTourTargets.toString()});
    w.__vetriTourEngine = (${runTourEngine.toString()});
  }
  if (!document.getElementById('__vetri-tour-style')) {
    var style = document.createElement('style');
    style.id = '__vetri-tour-style';
    style.textContent = ${JSON.stringify(driverCss)};
    (document.head || document.documentElement).appendChild(style);
  }
  return JSON.stringify(w.__vetriTourEngine(
    w.driver.js.driver,
    w.__vetriTourHolder,
    ${JSON.stringify(action)},
    w.__vetriTourCollect,
    document
  ));
})()`
}

/** Run one tour action in the page of the ACTIVE tab among those `owner`
 *  (the requesting session's stored id; omitted = the focused session) sees. */
export async function runPreviewTour(action: TourAction, owner?: PreviewOwner): Promise<TourResult> {
  const run = activePreviewScriptRunner(owner)

  if (!run) {
    return { error: 'No live page is open in the preview pane — open one first.', success: false }
  }

  const raw = await run(buildTourScript(action))

  if (typeof raw !== 'string' || !raw) {
    return { error: 'The page did not answer the tour action.', success: false }
  }

  return JSON.parse(raw) as TourResult
}
