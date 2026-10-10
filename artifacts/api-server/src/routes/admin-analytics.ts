import { Router, type IRouter } from "express";
import { Types, type FilterQuery } from "mongoose";
import type { DatabaseConnections } from "../db";
import { createAnalyticsModels, surveillanceCategories, type SurveillanceAggregate } from "../models/analytics";
import { etlStatusTracker } from "../etl/status";
import { logger } from "../lib/logger";

const K_THRESHOLD = 10;
const MAX_QUERY_ROWS = 5_000;
const categoryNames: Record<(typeof surveillanceCategories)[number], string> = {
  Respiratory: "Acute Respiratory Infections",
  VectorBorne: "Vector-Borne Diseases",
  Waterborne: "Waterborne & Diarrheal",
  Zoonotic: "Zoonotic Infections",
};

type AggregateValue =
  | { suppressed: true; reason: "NO_DATA" | "BELOW_K_THRESHOLD" }
  | { suppressed: false; count: number };

type AggregateRow = Pick<
  SurveillanceAggregate,
  | "period"
  | "category"
  | "displayName"
  | "regionId"
  | "stateName"
  | "districtName"
  | "caseCount"
  | "lastReportedAt"
  | "activeSurveillanceSites"
  | "coveragePercentage"
  | "riskLevel"
  | "monitoredDiseases"
  | "isSynthetic"
>;

interface StoredAuditEvent {
  _id?: Types.ObjectId;
  actorUserId?: string;
  actorRole?: string;
  organizationId?: Types.ObjectId;
  action?: string;
  resourceType?: string;
  resourceReference?: string;
  result?: "SUCCESS" | "DENIED" | "FAILURE";
  correlationId?: string;
  occurredAt?: Date;
}

export function aggregateCount(rows: readonly Pick<AggregateRow, "caseCount">[]): AggregateValue {
  const activeRows = rows.filter((row) => row.caseCount > 0);
  if (activeRows.length === 0) return { suppressed: true, reason: "NO_DATA" };
  if (activeRows.some((row) => row.caseCount < K_THRESHOLD)) {
    return { suppressed: true, reason: "BELOW_K_THRESHOLD" };
  }
  return {
    suppressed: false,
    count: activeRows.reduce((sum, row) => sum + row.caseCount, 0),
  };
}

function toMonthString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthWindow(start?: string, end?: string): { start: string; end: string } | null {
  const current = new Date();
  const defaultEnd = toMonthString(current);
  const defaultStartDate = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 5, 1));
  const first = start ?? toMonthString(defaultStartDate);
  const last = end ?? defaultEnd;
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!monthPattern.test(first) || !monthPattern.test(last) || first > last) return null;
  const [startYear, startMonth] = first.split("-").map(Number);
  const [endYear, endMonth] = last.split("-").map(Number);
  if ((endYear - startYear) * 12 + endMonth - startMonth > 23) return null;
  return { start: first, end: last };
}

function periodsInRange(start: string, end: string): string[] {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const periods: string[] = [];
  for (let value = startYear * 12 + startMonth - 1; value <= endYear * 12 + endMonth - 1; value += 1) {
    periods.push(`${Math.floor(value / 12)}-${String((value % 12) + 1).padStart(2, "0")}`);
  }
  return periods;
}

function monthLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function safeAction(action: unknown): string {
  return typeof action === "string" && /^[A-Z0-9_:-]{1,80}$/.test(action)
    ? action
    : "OTHER_ACTION";
}

export function createAdminAnalyticsRouter(
  connections: DatabaseConnections | undefined,
): IRouter {
  const router: IRouter = Router();
  const analyticsConnection = connections?.analytics;
  if (
    !analyticsConnection ||
    typeof (analyticsConnection as unknown as { model?: unknown }).model !== "function" ||
    typeof (analyticsConnection as unknown as { collection?: unknown }).collection !== "function"
  ) {
    router.use((_req, res) => res.status(503).json({ error: { code: "DATABASE_UNAVAILABLE", message: "Analytics data is unavailable." } }));
    return router;
  }

  const Aggregate = createAnalyticsModels(analyticsConnection).SurveillanceAggregate;
  const auditCollection = analyticsConnection.collection<StoredAuditEvent>("auditLogs");

  router.use((req, res, next) => {
    res.once("finish", () => {
      const organizationId = req.auth?.organizationId;
      if (!req.auth || !organizationId || !Types.ObjectId.isValid(organizationId)) return;
      const routePath = typeof req.route?.path === "string" ? req.route.path : "unknown";
      const action = `ADMIN_${req.method}_${routePath.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}`.slice(0, 80);
      void auditCollection.insertOne({
        actorUserId: req.auth.userId,
        actorRole: "ADMIN",
        organizationId: new Types.ObjectId(organizationId),
        action,
        resourceType: "ADMIN_ANALYTICS",
        resourceReference: "AGGREGATE_ONLY",
        result: res.statusCode >= 500 ? "FAILURE" : res.statusCode >= 400 ? "DENIED" : "SUCCESS",
        correlationId: req.requestId ?? "unknown",
        occurredAt: new Date(),
      }).catch(() => logger.error("Failed to persist administrator audit event"));
    });
    next();
  });

  const loadRows = async (filter: FilterQuery<SurveillanceAggregate> = {}): Promise<AggregateRow[]> => {
    const rows = await Aggregate.find(filter).sort({ period: 1 }).limit(MAX_QUERY_ROWS + 1).lean().exec();
    if (rows.length > MAX_QUERY_ROWS) {
      throw new Error("The requested analytics range exceeds the supported result limit.");
    }
    return rows as AggregateRow[];
  };

  router.get("/summary", async (_req, res, next) => {
    try {
      const window = monthWindow();
      if (!window) throw new Error("Unable to select the analytics reporting window.");
      const rows = await loadRows({ period: { $gte: window.start, $lte: window.end } });
      const periods = periodsInRange(window.start, window.end);
      const latestPeriod = rows.at(-1)?.period;
      const latestRows = latestPeriod ? rows.filter((row) => row.period === latestPeriod) : [];
      const latestRegions = groupBy(latestRows, (row) => `${row.stateName}\u0000${row.districtName ?? ""}`);
      const categories = groupBy(latestRows, (row) => row.category);
      const lastReportedAt = rows.reduce<Date | null>((latest, row) => {
        return !latest || row.lastReportedAt > latest ? row.lastReportedAt : latest;
      }, null);

      res.json({
        kpi: {
          totalReportedCases: aggregateCount(latestRows),
          monitoredConditionsCount: [...categories.values()].filter((group) => !aggregateCount(group).suppressed).length,
          coveredRegionsCount: new Set(latestRows.map((row) => row.regionId)).size,
          lastUpdated: lastReportedAt?.toISOString() ?? null,
          isDemoData: rows.some((row) => row.isSynthetic),
        },
        monthlyTrends: periods.map((period) => {
          const monthRows = rows.filter((row) => row.period === period);
          const categoriesForMonth = groupBy(monthRows, (row) => row.category);
          const value = (category: (typeof surveillanceCategories)[number]) =>
            aggregateCount(categoriesForMonth.get(category) ?? []);
          return {
            month: period,
            label: monthLabel(period),
            Respiratory: value("Respiratory"),
            VectorBorne: value("VectorBorne"),
            Waterborne: value("Waterborne"),
            Zoonotic: value("Zoonotic"),
          };
        }),
        conditionDistribution: surveillanceCategories.flatMap((category) => {
          const group = categories.get(category);
          if (!group) return [];
          return [{ category, displayName: categoryNames[category], value: aggregateCount(group) }];
        }),
        regionalOverview: [...latestRegions.entries()].map(([key, group]) => {
          const [stateName, districtName] = key.split("\u0000");
          const levels = new Set(group.flatMap((row) => row.riskLevel ? [row.riskLevel] : []));
          const last = group.reduce((latest, row) => row.lastReportedAt > latest ? row.lastReportedAt : latest, group[0].lastReportedAt);
          return {
            regionId: group[0].regionId,
            stateName,
            ...(districtName ? { districtName } : {}),
            cases: aggregateCount(group),
            riskLevel: levels.size === 1 ? [...levels][0] : "UNKNOWN",
            lastReported: last.toISOString(),
          };
        }),
        recentActivity: [],
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/trends", async (req, res, next) => {
    try {
      const condition = typeof req.query.condition === "string" && req.query.condition ? req.query.condition : undefined;
      const state = typeof req.query.state === "string" && req.query.state ? req.query.state : undefined;
      const district = typeof req.query.district === "string" && req.query.district ? req.query.district : undefined;
      const start = typeof req.query.startMonth === "string" ? req.query.startMonth : undefined;
      const end = typeof req.query.endMonth === "string" ? req.query.endMonth : undefined;
      if (condition && !surveillanceCategories.includes(condition as (typeof surveillanceCategories)[number])) {
        res.status(400).json({ error: { code: "INVALID_FILTER", message: "Unknown condition category." } });
        return;
      }
      if ([state, district].some((value) => value !== undefined && (value.length > 80 || /[\x00-\x1f]/.test(value)))) {
        res.status(400).json({ error: { code: "INVALID_FILTER", message: "Invalid region filter." } });
        return;
      }
      const window = monthWindow(start, end);
      if (!window) {
        res.status(400).json({ error: { code: "INVALID_DATE_RANGE", message: "Use a valid range of at most 24 whole months." } });
        return;
      }
      const filter: FilterQuery<SurveillanceAggregate> = {
        period: { $gte: window.start, $lte: window.end },
        ...(condition ? { category: condition } : {}),
        ...(state ? { stateName: state } : {}),
        ...(district ? { districtName: district } : {}),
      };
      const rows = await loadRows(filter);
      const periods = periodsInRange(window.start, window.end);
      const monthlyData = periods.map((period) => {
        const value = aggregateCount(rows.filter((row) => row.period === period));
        return { month: period, label: monthLabel(period), cases: value, condition: condition ?? "All Conditions", state, district };
      });
      const visible = monthlyData.filter((entry) => !entry.cases.suppressed);
      const peak = visible.reduce<(typeof visible)[number] | null>((best, current) => {
        return !best || (!current.cases.suppressed && !best.cases.suppressed && current.cases.count > best.cases.count) ? current : best;
      }, null);
      res.json({
        filters: { condition, state, district, startMonth: window.start, endMonth: window.end },
        monthlyData,
        summary: {
          totalMonthsAnalyzed: rows.length ? periods.length : 0,
          ...(visible.length === monthlyData.length && peak ? { peakMonth: peak.month } : {}),
          suppressedGroupCount: monthlyData.filter((entry) => entry.cases.suppressed && entry.cases.reason === "BELOW_K_THRESHOLD").length,
          visibleGroupCount: visible.length,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conditions", async (_req, res, next) => {
    try {
      const window = monthWindow();
      if (!window) throw new Error("Unable to select the analytics reporting window.");
      const rows = await loadRows({ period: { $gte: window.start, $lte: window.end } });
      const latestPeriod = rows.at(-1)?.period;
      const periods = periodsInRange(window.start, window.end);
      const result = surveillanceCategories.flatMap((category) => {
        const categoryRows = rows.filter((row) => row.category === category);
        if (categoryRows.length === 0) return [];
        const latestRows = categoryRows.filter((row) => row.period === latestPeriod);
        const names = [...new Set(categoryRows.flatMap((row) => row.monitoredDiseases))];
        return [{
          categoryId: category,
          name: categoryNames[category],
          description: "Privacy-protected monthly surveillance aggregates.",
          totalCases: aggregateCount(latestRows),
          monitoredDiseases: names,
          monthlyTrend: periods.map((period) => ({
            month: period,
            label: monthLabel(period),
            cases: aggregateCount(categoryRows.filter((row) => row.period === period)),
          })),
        }];
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/regions", async (_req, res, next) => {
    try {
      const rows = await loadRows();
      const latestPeriod = rows.at(-1)?.period;
      const latestRows = latestPeriod ? rows.filter((row) => row.period === latestPeriod) : [];
      const states = groupBy(latestRows, (row) => row.stateName);
      const regions = [...states.entries()].map(([state, stateRows]) => {
        const districtRows = stateRows.filter((row) => row.districtName);
        const children = districtRows.length ? districtRows : stateRows;
        const districts = [...groupBy(children, (row) => row.districtName ?? state).entries()].map(([district, group]) => {
          const siteCounts = group.flatMap((row) => typeof row.activeSurveillanceSites === 'number' ? [row.activeSurveillanceSites] : []);
          return {
            district,
            cases: aggregateCount(group),
            activeSurveillanceSites: siteCounts.length ? Math.max(...siteCounts) : null,
            lastReportedDate: group.reduce((latest, row) => row.lastReportedAt > latest ? row.lastReportedAt : latest, group[0].lastReportedAt).toISOString(),
          };
        });
        const coverage = [...new Set(stateRows.flatMap((row) => typeof row.coveragePercentage === "number" ? [row.coveragePercentage] : []))];
        return {
          state,
          stateTotalCases: aggregateCount(children),
          coveragePercentage: coverage.length ? coverage.reduce((sum, value) => sum + value, 0) / coverage.length : null,
          districts,
        };
      });
      res.json({
        totalStates: regions.length,
        totalDistricts: regions.reduce((sum, region) => sum + region.districts.length, 0),
        lastSyncTime: rows.length ? rows.reduce((latest, row) => row.lastReportedAt > latest ? row.lastReportedAt : latest, rows[0].lastReportedAt).toISOString() : null,
        regions,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/privacy-config", async (_req, res, next) => {
    try {
      const rows = await loadRows();
      const totalQueriesProcessed = await auditCollection.countDocuments({ action: { $regex: "^ADMIN_" } });
      const suppressedGroups = rows.filter((row) => row.caseCount < K_THRESHOLD).length;
      const safeGroups = rows.length - suppressedGroups;
      res.json({
        minimumKThreshold: K_THRESHOLD,
        policyName: "Public Health Aggregate Anonymization Protocol",
        policyDescription: "Aggregate groups below K=10 are suppressed, and parent totals are suppressed when any contributing group is hidden.",
        enforcedByBackend: true,
        complementarySuppressionActive: true,
        metrics: {
          totalQueriesProcessed,
          suppressedGroupPercentage: rows.length ? Number(((suppressedGroups / rows.length) * 100).toFixed(1)) : 0,
          safeAggregatesServed: safeGroups,
        },
        sampleDivergence: {
          visibleExample: { suppressed: false, count: 27 },
          suppressedExample: { suppressed: true, reason: "BELOW_K_THRESHOLD" },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit", async (req, res, next) => {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 10);
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        res.status(400).json({ error: { code: "INVALID_PAGINATION", message: "Page must be positive and pageSize must be between 1 and 100." } });
        return;
      }
      const [totalEvents, events] = await Promise.all([
        auditCollection.countDocuments({}),
        auditCollection.find({}, { projection: { actorRole: 1, action: 1, result: 1, correlationId: 1, occurredAt: 1 } })
          .sort({ occurredAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      ]);
      res.json({
        page,
        pageSize,
        totalEvents,
        events: events.map((event) => ({
          id: event._id.toString(),
          timestamp: event.occurredAt?.toISOString() ?? new Date(0).toISOString(),
          eventCategory: "ADMINISTRATION",
          action: safeAction(event.action),
          outcome: event.result ?? "FAILURE",
          actorRef: event.actorRole === "ADMIN" ? "ADMIN" : "SYSTEM",
          correlationId: event.correlationId ?? "unavailable",
          detailsSummary: "Administrator action recorded; resource details are withheld.",
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/security-events", async (_req, res, next) => {
    try {
      const events = await auditCollection.find({ result: { $in: ["DENIED", "FAILURE"] } }, {
        projection: { action: 1, result: 1, correlationId: 1, occurredAt: 1 },
      }).sort({ occurredAt: -1 }).limit(100).toArray();
      const totalAuditEvents = await auditCollection.countDocuments({});
      res.json({
        securityStatus: events.length ? "DEGRADED" : totalAuditEvents ? "OPTIMAL" : "DEGRADED",
        activeThreatCount: events.filter((event) => event.occurredAt && Date.now() - event.occurredAt.getTime() < 24 * 60 * 60 * 1000).length,
        lastAuditRun: new Date().toISOString(),
        events: events.map((event) => ({
          id: `sec_${event._id.toString().slice(-8)}`,
          timestamp: event.occurredAt?.toISOString() ?? new Date(0).toISOString(),
          eventType: event.result === "DENIED" ? "ACCESS_DENIED" : "UNAUTHORIZED_ROUTE",
          severity: "MEDIUM",
          status: event.result === "DENIED" ? "BLOCKED" : "LOGGED",
          safeReference: /^[a-zA-Z0-9_-]{1,80}$/.test(event.correlationId ?? "") ? event.correlationId : `sec_${event._id.toString().slice(-8)}`,
          summary: "A request was rejected or failed; patient and resource details are withheld.",
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/etl-status", async (_req, res, next) => {
    try {
      const snapshot = etlStatusTracker.getSnapshot();
      const checkpoint = await analyticsConnection.collection("etlCheckpoints").findOne({ streamName: "conditions" });
      const ledgerCount = await analyticsConnection.collection("etlLedgers").countDocuments({ status: "ACTIVE" });
      res.json({
        ...snapshot,
        totalActiveLedgerRecords: ledgerCount,
        checkpointTimestamp: checkpoint?.lastCheckpointedAt ? new Date(checkpoint.lastCheckpointedAt).toISOString() : null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}