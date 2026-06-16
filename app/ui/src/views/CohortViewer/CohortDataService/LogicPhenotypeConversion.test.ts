/**
 * Test for LogicPhenotype expression conversion between UI and backend formats
 * 
 * Run this test to verify that the conversion functions work correctly.
 */

import { CohortDataService } from '../CohortDataService/CohortDataService';

// Mock phenotypes that will be used in expressions
const mockPhenotypes = [
  {
    id: 'p1',
    name: 'Diabetes',
    class_name: 'CodelistPhenotype',
    type: 'component',
    domain: 'CONDITION_OCCURRENCE',
    codelist: { class_name: 'Codelist', codelist: { None: ['diabetes_code'] } }
  },
  {
    id: 'p2',
    name: 'Hypertension',
    class_name: 'CodelistPhenotype',
    type: 'component',
    domain: 'CONDITION_OCCURRENCE',
    codelist: { class_name: 'Codelist', codelist: { None: ['hypertension_code'] } }
  },
  {
    id: 'p3',
    name: 'Obesity',
    class_name: 'CodelistPhenotype',
    type: 'component',
    domain: 'CONDITION_OCCURRENCE',
    codelist: { class_name: 'Codelist', codelist: { None: ['obesity_code'] } }
  }
];

// Mock LogicPhenotype in UI format
const uiLogicPhenotype = {
  id: 'lp1',
  name: 'Complex Condition',
  class_name: 'LogicPhenotype',
  type: 'inclusion',
  logical_expression: {
    class_name: 'AndFilter',
    filter1: {
      class_name: 'LogicalExpression',
      phenotype_id: 'p1',
      phenotype_name: 'Diabetes',
      status: 'filled',
      id: 'le1'
    },
    filter2: {
      class_name: 'OrFilter',
      filter1: {
        class_name: 'LogicalExpression',
        phenotype_id: 'p2',
        phenotype_name: 'Hypertension',
        status: 'filled',
        id: 'le2'
      },
      filter2: {
        class_name: 'LogicalExpression',
        phenotype_id: 'p3',
        phenotype_name: 'Obesity',
        status: 'filled',
        id: 'le3'
      }
    }
  }
};

// Mock cohort with LogicPhenotype
const mockCohort = {
  id: 'cohort1',
  name: 'Test Cohort',
  class_name: 'Cohort',
  phenotypes: [...mockPhenotypes, uiLogicPhenotype],
  database_config: {},
  constants: []
};

/**
 * Test: UI → Backend conversion
 */
function testUIToBackendConversion() {
  console.log('🧪 Testing UI → Backend conversion...');
  
  const dataService = CohortDataService.getInstance();
  
  // Use the private method via type assertion (for testing only)
  const cohortForExecution = (dataService as any).prepareCohortForExecution(mockCohort);
  
  // Find the LogicPhenotype in the converted cohort
  const convertedLogicPhenotype = cohortForExecution.phenotypes.find(
    (p: any) => p.id === 'lp1'
  );
  
  console.log('Converted LogicPhenotype:', JSON.stringify(convertedLogicPhenotype, null, 2));
  
  // Assertions
  if (!convertedLogicPhenotype) {
    throw new Error('❌ LogicPhenotype not found in converted cohort');
  }
  
  if (!convertedLogicPhenotype.expression) {
    throw new Error('❌ expression field missing');
  }
  
  if (convertedLogicPhenotype.expression.class_name !== 'ComputationGraph') {
    throw new Error('❌ expression should be ComputationGraph');
  }
  
  if (convertedLogicPhenotype.expression.operator !== '&') {
    throw new Error('❌ Top-level operator should be &');
  }
  
  if (convertedLogicPhenotype.expression.left.id !== 'p1') {
    throw new Error('❌ Left operand should be Diabetes phenotype');
  }
  
  if (convertedLogicPhenotype.expression.right.class_name !== 'ComputationGraph') {
    throw new Error('❌ Right operand should be ComputationGraph');
  }
  
  if (convertedLogicPhenotype.expression.right.operator !== '|') {
    throw new Error('❌ Nested operator should be |');
  }
  
  if (convertedLogicPhenotype.logical_expression) {
    throw new Error('❌ logical_expression should be removed');
  }
  
  console.log('✅ UI → Backend conversion test passed!');
}

/**
 * Test: Backend → UI conversion
 */
function testBackendToUIConversion() {
  console.log('🧪 Testing Backend → UI conversion...');
  
  const dataService = CohortDataService.getInstance();
  
  // Mock backend LogicPhenotype with ComputationGraph
  const backendLogicPhenotype = {
    id: 'lp1',
    name: 'Complex Condition',
    class_name: 'LogicPhenotype',
    type: 'inclusion',
    expression: {
      class_name: 'ComputationGraph',
      operator: '&',
      left: {
        id: 'p1',
        name: 'Diabetes',
        class_name: 'CodelistPhenotype'
      },
      right: {
        class_name: 'ComputationGraph',
        operator: '|',
        left: {
          id: 'p2',
          name: 'Hypertension',
          class_name: 'CodelistPhenotype'
        },
        right: {
          id: 'p3',
          name: 'Obesity',
          class_name: 'CodelistPhenotype'
        }
      }
    }
  };
  
  // Use the private method via type assertion (for testing only)
  const convertedPhenotype = (dataService as any).convertLogicPhenotypeForUI(backendLogicPhenotype);
  
  console.log('Converted LogicPhenotype:', JSON.stringify(convertedPhenotype, null, 2));
  
  // Assertions
  if (!convertedPhenotype.logical_expression) {
    throw new Error('❌ logical_expression field missing');
  }
  
  if (convertedPhenotype.logical_expression.class_name !== 'AndFilter') {
    throw new Error('❌ Top-level should be AndFilter');
  }
  
  if (convertedPhenotype.logical_expression.filter1.phenotype_id !== 'p1') {
    throw new Error('❌ filter1 should reference p1');
  }
  
  if (convertedPhenotype.logical_expression.filter2.class_name !== 'OrFilter') {
    throw new Error('❌ filter2 should be OrFilter');
  }
  
  console.log('✅ Backend → UI conversion test passed!');
}

/**
 * Test: Round-trip conversion (UI → Backend → UI)
 */
function testRoundTripConversion() {
  console.log('🧪 Testing round-trip conversion...');
  
  const dataService = CohortDataService.getInstance();
  
  // UI → Backend
  const cohortForExecution = (dataService as any).prepareCohortForExecution(mockCohort);
  const backendLogicPhenotype = cohortForExecution.phenotypes.find(
    (p: any) => p.id === 'lp1'
  );
  
  // Backend → UI
  const uiLogicPhenotypeAgain = (dataService as any).convertLogicPhenotypeForUI(backendLogicPhenotype);
  
  console.log('Original UI:', JSON.stringify(uiLogicPhenotype.logical_expression, null, 2));
  console.log('After round-trip:', JSON.stringify(uiLogicPhenotypeAgain.logical_expression, null, 2));
  
  // Verify structure is preserved (ignoring id fields which are regenerated)
  if (uiLogicPhenotypeAgain.logical_expression.class_name !== 'AndFilter') {
    throw new Error('❌ Round-trip failed: top-level class_name mismatch');
  }
  
  if (uiLogicPhenotypeAgain.logical_expression.filter1.phenotype_id !== 'p1') {
    throw new Error('❌ Round-trip failed: filter1 phenotype_id mismatch');
  }
  
  if (uiLogicPhenotypeAgain.logical_expression.filter2.class_name !== 'OrFilter') {
    throw new Error('❌ Round-trip failed: filter2 class_name mismatch');
  }
  
  console.log('✅ Round-trip conversion test passed!');
}

// Run all tests
export function runLogicPhenotypeConversionTests() {
  console.log('🚀 Starting LogicPhenotype conversion tests...\n');
  
  try {
    testUIToBackendConversion();
    console.log('');
    
    testBackendToUIConversion();
    console.log('');
    
    testRoundTripConversion();
    console.log('');
    
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Uncomment to run tests immediately
// runLogicPhenotypeConversionTests();
