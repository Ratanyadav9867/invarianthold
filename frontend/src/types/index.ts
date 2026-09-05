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
