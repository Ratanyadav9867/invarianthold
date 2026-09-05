export type Role = 'ADMIN' | 'SECURITY_ANALYST' | 'VIEWER';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ComponentData {
  id: string;
  name: string;
  type: string;
  status: 'HEALTHY' | 'FAILED' | 'DEGRADED' | string;
  zone: string;
  health_score: number;
  capabilities: string[];
  latency_ms: number;
  failure_count: number;
  last_failure_at: string | null;
  meta_info?: Record<string, any>;
}

export interface InvariantData {
  id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  source_zones: string[];
  destination_zones: string[];
  required_controls: string[];
  forbidden_conditions: string[];
  enabled: boolean;
  created_at?: string;
}

export interface PathData {
  id: string;
  name: string;
  source_node: string;
  destination_node: string;
  current_hops: string[];
  alternate_hops: string[];
  applicable_invariant_id: string | null;
  status: 'GUARANTEED' | 'AT_RISK' | 'VIOLATED' | 'BLOCKED' | 'REROUTED' | 'NO_POLICY' | string;
  is_active: boolean;
  decision_reason: string;
  last_verified_at?: string;
}

export interface TrafficStats {
  total_packets: number;
  delivered: number;
  rerouted: number;
  blocked: number;
  dropped: number;
  safe_packets_delivered: number;
  unsafe_traffic_delivered: number;
  safe_traffic_preserved_pct: number;
  average_latency_ms: number;
  safety_guarantee_verified: boolean;
  sample_packets_count: number;
}

export interface TrafficPacket {
  id: string;
  path_id: string;
  source: string;
  destination: string;
  protocol: string;
  size_bytes: number;
  status: 'DELIVERED' | 'REROUTED' | 'BLOCKED' | 'DROPPED' | string;
  is_safe: boolean;
  boundary_crossed: string;
  latency_ms: number;
  timestamp: string;
}

export interface AnomalyAnalysis {
  anomaly_score: number;
  is_anomaly: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  contributing_metrics: Record<string, number>;
  raw_features?: Record<string, number>;
  advisory_note?: string;
}

export interface RiskFactors {
  severity_score: number;
  blast_radius: number;
  anomaly_score: number;
  cascading_risk: number;
}

export interface RiskAssessment {
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  factors: RiskFactors;
  explanation: string;
}

export interface AIData {
  telemetry_analysis: AnomalyAnalysis;
  risk_assessment: RiskAssessment;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  details: Record<string, any>;
  previous_hash: string;
  current_hash: string;
}

export interface AuditVerificationResult {
  valid: boolean;
  total_records: number;
  status: string;
  message: string;
  tampered_id?: number;
  error?: string;
}

export interface DemoTimelineStep {
  step: number;
  title: string;
  narration: string;
  metrics: Record<string, any>;
}

export interface DemoScorecard {
  total_paths_monitored: number;
  safe_paths_preserved: number;
  unnecessary_paths_blocked: number;
  unsafe_traffic_delivered: number;
  safe_path_preservation_pct: number;
  verdict: string;
}

export interface JudgeDemoResult {
  demo_status: string;
  timeline: DemoTimelineStep[];
  scorecard: DemoScorecard;
  runtime_seconds: number;
}

export interface SubsystemHealthInfo {
  status: string;
  [key: string]: any;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment?: string;
  subsystems?: Record<string, SubsystemHealthInfo>;
  database: string;
  ml_engine: string;
  simulation_engine: string;
}

export interface TopologyNode {
  id: string;
  label: string;
  type: string;
  zone: string;
  component_id?: string;
  pos_x: number;
  pos_y: number;
  data?: Record<string, any>;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  latency_ms: number;
}

export interface GraphTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  stats: {
    total_nodes: number;
    total_edges: number;
    total_components: number;
  };
}

// 1. Predictive Invariant Failure Types
export interface PredictedRiskItem {
  component_id: string;
  component_name: string;
  predicted_risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  contributing_factors: Record<string, number | string>;
  recommended_preventive_action: string;
  horizon_minutes: number;
}

export interface PredictionReport {
  timestamp: string;
  predictions: PredictedRiskItem[];
  high_risk_count: number;
  total_assessed: number;
  model_type: string;
}

// 2. Digital Twin & What-If Simulation Types
export interface SimulationScenarioRequest {
  scenario_type: 'COMPONENT_FAIL' | 'ZONE_ISOLATION' | 'TRAFFIC_SPIKE' | 'LATENCY_DEGRADATION' | 'CONTROL_BYPASS';
  target_nodes: string[];
  parameters?: Record<string, any>;
}

export interface SimulationResult {
  simulation_id: string;
  scenario: string;
  timestamp: string;
  twin_summary: {
    total_nodes: number;
    total_edges: number;
    healthy_nodes: number;
    failed_nodes: number;
  };
  affected_paths: Array<{
    path_id: string;
    path_name: string;
    status: string;
    impact: string;
  }>;
  preserved_paths: string[];
  invariants_at_risk: Array<{
    invariant_id: string;
    name: string;
    severity: string;
    reason: string;
  }>;
  blast_radius_estimate: number;
  live_state_modified: boolean;
  recommendations: string[];
}

// 3. Autonomous Safe Recovery Types
export type RecoveryMode = 'MONITOR' | 'RECOMMEND' | 'AUTO';

export interface RecoveryAction {
  action_type: string;
  path_id: string;
  path_name: string;
  from_hops: string[];
  to_hops: string[];
  reason: string;
  invariant_guaranteed: boolean;
}

export interface RecoveryPlan {
  mode: RecoveryMode;
  candidates_analyzed: number;
  actions: RecoveryAction[];
  safe_traffic_preserved_pct: number;
  unsafe_traffic_delivered: number;
  execution_ready: boolean;
}

export interface RecoveryExecuteResponse {
  executed: boolean;
  mode: RecoveryMode;
  actions_taken: RecoveryAction[];
  paths_recovered: number;
  unsafe_traffic_delivered: number;
  status: string;
  timestamp: string;
}

// 4. Blast Radius & Attack Path Analysis Types
export interface BlastRadiusResult {
  target_components: string[];
  direct_dependents: string[];
  transitive_dependents: string[];
  total_affected: number;
  critical_services_impacted: string[];
  blast_percentage: number;
  risk_score: number;
  paths_interrupted: number;
  paths_resilient: number;
}

export interface AttackStep {
  from_node: string;
  to_node: string;
  vulnerability_or_risk: string;
  controls_bypassed?: string[];
}

export interface AttackPathItem {
  target_zone: string;
  target_node: string;
  path: string[];
  steps: AttackStep[];
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  criticality: number;
}

export interface AttackPathResult {
  source_id: string;
  target_zones: string[];
  attack_paths: AttackPathItem[];
  total_paths_found: number;
  highest_risk_path?: AttackPathItem;
  recommended_chokepoints: string[];
}

// 5. Chaos Security Testing Types
export interface ChaosRunRequest {
  chaos_type: string;
  components: string[];
  label?: string;
  intensity?: number;
}

export interface ChaosTestResult {
  test_id: string;
  scenario: string;
  intensity: number;
  target_components: string[];
  paths_evaluated: number;
  invariants_tested: number;
  unsafe_traffic_delivered: number;
  safety_maintained: boolean;
  detailed_verdict: string;
  live_state_modified: boolean;
  timestamp: string;
}

export interface ChaosBatchResult {
  batch_id: string;
  total_tests: number;
  passed: number;
  failed: number;
  results: ChaosTestResult[];
  aggregate_safety_score: number;
}

export interface ChaosSecurityReport {
  summary: {
    total_runs: number;
    pass_rate_pct: number;
    zero_unsafe_traffic_verified: boolean;
  };
  test_history: ChaosTestResult[];
  invariant_resilience_matrix: Array<{
    invariant_id: string;
    name: string;
    times_tested: number;
    held_firm_pct: number;
  }>;
  recommendations: string[];
  generated_at: string;
}
