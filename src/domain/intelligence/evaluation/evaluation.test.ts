import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { encodeReports, runScenario } from "./harness";
import { allScenarios, scenario } from "./scenarios";
import { makeEvaluationWrap } from "./wrap";

/** iOS `IntelligenceEvaluationTests`. `INTELLIGENCE_EVALUATION_OUTPUT` writes the suite export for the iOS diff. */
describe("intelligence evaluation", () => {
  it("findings detect safety and quality regressions", () => {
    const quiet = scenario("quiet-regression", { quiet: true });
    const now = quiet.input.generatedAt;
    const at = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
    quiet.qualifications = [
      [{ version: 1, kind: "verified_movement", factKey: "unexpected-interruption", checkedAt: at(now - 10_000), expiresAt: at(now + 60_000) }, "A"],
    ];
    quiet.expectations.push({ name: "Useful discovery", severity: "quality", rule: "usefulContent" });
    const report = runScenario(quiet, makeEvaluationWrap);
    expect(report.findings.some((finding) => finding.severity === "hard" && !finding.passed)).toBe(true);
    expect(report.findings.some((finding) => finding.severity === "quality" && !finding.passed)).toBe(true);
  });

  it("scenario suite", () => {
    const reports = allScenarios().map((value) => runScenario(value, makeEvaluationWrap));
    // Persist before asserting so a safety regression still produces a review artifact.
    const output = process.env.INTELLIGENCE_EVALUATION_OUTPUT;
    if (output) writeFileSync(output, `${encodeReports(reports)}\n`);
    for (const report of reports) {
      for (const finding of report.findings.filter((value) => value.severity === "hard"))
        expect(finding.passed, `${report.scenario}: ${finding.name}`).toBe(true);
      expect(report.traceOmissions, `${report.scenario}: incomplete decision evidence`).toBe(0);
      for (const ids of Object.values(report.surfaces)) expect(new Set(ids).size, `${report.scenario}: duplicate surface item`).toBe(ids.length);
    }
  });

  it("deterministic report and input order", () => {
    const library = allScenarios();
    const first = encodeReports(library.map((value) => runScenario(value, makeEvaluationWrap)));
    const second = encodeReports(library.map((value) => runScenario(value, makeEvaluationWrap)));
    expect(first).toBe(second);
    const base = scenario("determinism", { holdings: { A: 4 }, watched: ["B", "D"] });
    const one = runScenario(base, makeEvaluationWrap);
    const two = runScenario(base, makeEvaluationWrap);
    expect(encodeReports([one])).toBe(encodeReports([two]));
    const reordered = { ...base, input: { ...base.input, observations: [...base.input.observations].reverse() } };
    expect(runScenario(reordered, makeEvaluationWrap).surfaces).toEqual(one.surfaces);
  });
});
