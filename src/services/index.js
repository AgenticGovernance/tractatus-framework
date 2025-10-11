/**
 * Tractatus Governance Services
 * Core AI safety framework implementation
 *
 * These services implement the Tractatus-based LLM safety architecture:
 * - Time-persistence metadata classification
 * - Cross-reference validation against explicit instructions
 * - Architectural boundaries for human judgment
 * - Context pressure monitoring
 * - Metacognitive verification
 *
 * Together, these services prevent AI failures like the "27027 incident"
 * where explicit instructions are overridden by cached patterns.
 */

const InstructionPersistenceClassifier = require('./InstructionPersistenceClassifier.service');
const CrossReferenceValidator = require('./CrossReferenceValidator.service');
const BoundaryEnforcer = require('./BoundaryEnforcer.service');
const ContextPressureMonitor = require('./ContextPressureMonitor.service');
const MetacognitiveVerifier = require('./MetacognitiveVerifier.service');

module.exports = {
  // Core governance services
  classifier: InstructionPersistenceClassifier,
  validator: CrossReferenceValidator,
  enforcer: BoundaryEnforcer,
  monitor: ContextPressureMonitor,
  verifier: MetacognitiveVerifier,

  // Convenience methods
  classifyInstruction: (instruction) => InstructionPersistenceClassifier.classify(instruction),
  validateAction: (action, context) => CrossReferenceValidator.validate(action, context),
  enforceBoundaries: (action, context) => BoundaryEnforcer.enforce(action, context),
  analyzePressure: (context) => ContextPressureMonitor.analyzePressure(context),
  verifyAction: (action, reasoning, context) => MetacognitiveVerifier.verify(action, reasoning, context),

  // Framework status
  getFrameworkStatus: () => ({
    name: 'Tractatus Governance Framework',
    version: '1.0.0',
    services: {
      InstructionPersistenceClassifier: 'operational',
      CrossReferenceValidator: 'operational',
      BoundaryEnforcer: 'operational',
      ContextPressureMonitor: 'operational',
      MetacognitiveVerifier: 'operational'
    },
    description: 'AI safety framework implementing architectural constraints for human agency preservation',
    capabilities: [
      'Instruction quadrant classification (STR/OPS/TAC/SYS/STO)',
      'Time-persistence metadata tagging',
      'Cross-reference validation',
      'Tractatus boundary enforcement (12.1-12.7)',
      'Context pressure monitoring',
      'Metacognitive action verification'
    ],
    safetyGuarantees: [
      'Values decisions architecturally require human judgment',
      'Explicit instructions override cached patterns',
      'Dangerous pressure conditions block execution',
      'Low-confidence actions require confirmation'
    ]
  })
};
