import { executeStudy } from '../../../api/execute_cohort/route';

/**
 * CohortExecutionService
 * 
 * Handles cohort execution and format conversion between UI and backend representations.
 * 
 * Responsibilities:
 * - Execute cohorts against the backend
 * - Convert UI format (AndFilter/OrFilter) to backend format (ComputationGraph)
 * - Convert backend format (ComputationGraph) back to UI format
 * - Extract embedded component phenotypes from LogicPhenotype expressions
 * - Manage execution progress notifications
 */
export class CohortExecutionService {
  // Execution progress listeners
  private executionProgressListeners: Array<
    (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  > = [];

  /**
   * Execute a cohort against the backend
   * @param cohortData - The cohort data to execute
   * @param databaseConfig - Database configuration
   * @returns Updated cohort data with execution results
   */
  public async executeCohort(
    cohortData: Record<string, any>,
    databaseConfig: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      // Prepare cohort for execution (convert UI format to backend format)
      const cohortForExecution = this.prepareCohortForExecution(cohortData);
      
      const response = await executeStudy(
        {
          cohort: cohortForExecution,
          database_config: databaseConfig,
        },
        (message: string, type: 'log' | 'error' | 'result' | 'complete') => {
          // Handle streaming messages
          console.log(`[${type.toUpperCase()}]`, message);
          this.notifyExecutionProgressListeners(message, type);
        }
      );

      // Prepare response for UI (convert backend format to UI format)
      const processedCohort = this.preparePhenexCohortForUI(response.cohort);
      return processedCohort;
    } catch (error) {
      console.error('Error executing cohort:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.notifyExecutionProgressListeners(`Error: ${errorMessage}`, 'error');
      throw error;
    }
  }

  /**
   * Prepares cohort data for backend execution by converting UI representations to backend format.
   * Specifically handles LogicPhenotype expressions: converts UI's AndFilter/OrFilter with phenotype
   * references to backend's ComputationGraph with embedded phenotype objects.
   */
  private prepareCohortForExecution(cohortData: Record<string, any>): Record<string, any> {
    const cohortCopy = JSON.parse(JSON.stringify(cohortData));
    
    // Create a lookup map of all phenotypes by ID
    const phenotypesById: { [id: string]: any } = {};
    if (cohortCopy.phenotypes) {
      cohortCopy.phenotypes.forEach((p: any) => {
        phenotypesById[p.id] = p;
      });
    }
    
    // Convert all LogicPhenotypes in the phenotypes array
    if (cohortCopy.phenotypes) {
      cohortCopy.phenotypes = cohortCopy.phenotypes.map((phenotype: any) => 
        this.convertLogicPhenotypeForExecution(phenotype, phenotypesById)
      );
    }
    
    // Also convert in type-specific arrays
    if (cohortCopy.entry_criterion) {
      cohortCopy.entry_criterion = this.convertLogicPhenotypeForExecution(
        cohortCopy.entry_criterion, 
        phenotypesById
      );
    }
    if (cohortCopy.inclusions) {
      cohortCopy.inclusions = cohortCopy.inclusions.map((p: any) => 
        this.convertLogicPhenotypeForExecution(p, phenotypesById)
      );
    }
    if (cohortCopy.exclusions) {
      cohortCopy.exclusions = cohortCopy.exclusions.map((p: any) => 
        this.convertLogicPhenotypeForExecution(p, phenotypesById)
      );
    }
    if (cohortCopy.characteristics) {
      cohortCopy.characteristics = cohortCopy.characteristics.map((p: any) => 
        this.convertLogicPhenotypeForExecution(p, phenotypesById)
      );
    }
    if (cohortCopy.outcomes) {
      cohortCopy.outcomes = cohortCopy.outcomes.map((p: any) => 
        this.convertLogicPhenotypeForExecution(p, phenotypesById)
      );
    }
    
    return cohortCopy;
  }

  /**
   * Converts a single LogicPhenotype from UI format to backend format.
   * Converts logical_expression (AndFilter/OrFilter tree with phenotype IDs) 
   * to expression (ComputationGraph tree with embedded phenotype objects).
   */
  private convertLogicPhenotypeForExecution(
    phenotype: any, 
    phenotypesById: { [id: string]: any }
  ): any {
    if (phenotype.class_name !== 'LogicPhenotype') {
      return phenotype;
    }
    
    // Check if we have a logical_expression to convert
    const logicalExpression = phenotype.logical_expression || phenotype.expression;
    if (!logicalExpression) {
      console.warn(`LogicPhenotype '${phenotype.name}' missing logical_expression`);
      return phenotype;
    }
    
    // Convert the logical expression tree to a computation graph
    const expression = this.buildComputationGraph(logicalExpression, phenotypesById);
    
    // Create the backend-compatible phenotype
    const backendPhenotype = { ...phenotype };
    backendPhenotype.expression = expression;
    
    // Remove UI-specific field
    delete backendPhenotype.logical_expression;
    
    return backendPhenotype;
  }

  /**
   * Recursively builds a ComputationGraph from a UI logical expression tree.
   * Converts:
   *   - LogicalExpression (leaf node with phenotype_id) → embedded phenotype object
   *   - AndFilter → ComputationGraph with operator '&'
   *   - OrFilter → ComputationGraph with operator '|'
   */
  private buildComputationGraph(
    logicalExpr: any, 
    phenotypesById: { [id: string]: any }
  ): any {
    const className = logicalExpr.class_name;
    
    if (className === 'LogicalExpression') {
      // Leaf node - return the actual phenotype object
      const phenotypeId = logicalExpr.phenotype_id;
      if (!phenotypeId || !phenotypesById[phenotypeId]) {
        throw new Error(`Invalid or missing phenotype_id: ${phenotypeId}`);
      }
      
      // Return a copy of the phenotype to avoid circular references
      const phenotype = { ...phenotypesById[phenotypeId] };
      
      // Remove UI-specific properties that shouldn't go to backend
      delete phenotype.index;
      delete phenotype.level;
      delete phenotype.hierarchical_index;
      delete phenotype.colorCellBackground;
      delete phenotype.parentIds;
      delete phenotype.effective_type;
      
      return phenotype;
    } 
    else if (className === 'AndFilter' || className === 'OrFilter') {
      // Binary operator node - recursively convert children
      const operator = className === 'AndFilter' ? '&' : '|';
      
      const left = this.buildComputationGraph(logicalExpr.filter1, phenotypesById);
      const right = this.buildComputationGraph(logicalExpr.filter2, phenotypesById);
      
      return {
        class_name: 'ComputationGraph',
        left: left,
        right: right,
        operator: operator
      };
    }
    else {
      throw new Error(`Unknown logical expression class: ${className}`);
    }
  }

  /**
   * Prepares cohort data from backend (PhenEx) format for UI display.
   * Converts backend's ComputationGraph to UI's AndFilter/OrFilter structure.
   * Extracts embedded component phenotypes from LogicPhenotype expressions.
   */
  private preparePhenexCohortForUI(cohortData: Record<string, any>): Record<string, any> {
    // First, extract all embedded component phenotypes from LogicPhenotype expressions
    const extractedComponents: any[] = [];
    const allPhenotypes = [cohortData.entry_criterion]
      .concat(
        cohortData.inclusions || [],
        cohortData.exclusions || [],
        cohortData.characteristics || [],
        cohortData.outcomes || []
      );
    
    allPhenotypes.forEach((phenotype: any) => {
      if (phenotype.class_name === 'LogicPhenotype' && phenotype.expression) {
        // Pass the parent phenotype's type as the effective_type for extracted components
        const parentEffectiveType = phenotype.type;
        const components = this.extractComponentsFromExpression(
          phenotype.expression, 
          phenotype.id, 
          parentEffectiveType
        );
        extractedComponents.push(...components);
      }
    });
    
    console.log('Extracted components from expressions:', extractedComponents);
    
    // Now process the phenotypes - add type tags
    cohortData.entry_criterion.type = 'entry';
    this.appendTypeKeyToPhenotypes(cohortData.inclusions || [], 'inclusion');
    this.appendTypeKeyToPhenotypes(cohortData.exclusions || [], 'exclusion');
    this.appendTypeKeyToPhenotypes(cohortData.characteristics || [], 'baseline');
    this.appendTypeKeyToPhenotypes(cohortData.outcomes || [], 'outcome');

    // Combine all phenotypes including extracted components
    cohortData.phenotypes = [cohortData.entry_criterion]
      .concat(
        cohortData.inclusions || [],
        cohortData.exclusions || [],
        cohortData.characteristics || [],
        cohortData.outcomes || [],
        extractedComponents  // Add extracted components
      );
    
    // Convert all LogicPhenotypes from backend format to UI format
    cohortData.phenotypes = cohortData.phenotypes.map((phenotype: any) => 
      this.convertLogicPhenotypeForUI(phenotype)
    );
    
    console.log("FINISHED EXECUTING AND PROCESSING", cohortData);
    
    return cohortData;
  }

  /**
   * Recursively extracts component phenotypes from a ComputationGraph expression.
   * Sets them as 'component' type and establishes parent relationship.
   * Adds UI-specific properties for proper display.
   */
  private extractComponentsFromExpression(expression: any, parentPhenotypeId: string, parentEffectiveType?: string): any[] {
    const components: any[] = [];
    
    if (expression.class_name === 'ComputationGraph') {
      // Recursively extract from left and right
      components.push(...this.extractComponentsFromExpression(expression.left, parentPhenotypeId, parentEffectiveType));
      components.push(...this.extractComponentsFromExpression(expression.right, parentPhenotypeId, parentEffectiveType));
    } else {
      // This is a leaf node (actual phenotype) - it's a component
      const component = { ...expression };
      component.type = 'component';
      component.parentIds = [parentPhenotypeId];
      
      // Set effective_type based on parent's effective type
      // This determines visual styling and categorization in the UI
      if (parentEffectiveType) {
        component.effective_type = parentEffectiveType;
      }
      
      // Add UI-specific property for component phenotypes
      // This affects how the phenotype is displayed in the grid
      component.colorCellBackground = true;
      
      // If this component is itself a LogicPhenotype, recursively extract its components
      if (component.class_name === 'LogicPhenotype' && component.expression) {
        const nestedComponents = this.extractComponentsFromExpression(
          component.expression, 
          component.id,
          component.effective_type || parentEffectiveType
        );
        components.push(...nestedComponents);
      }
      
      components.push(component);
    }
    
    return components;
  }

  /**
   * Converts a LogicPhenotype from backend format (with ComputationGraph) 
   * to UI format (with AndFilter/OrFilter tree).
   */
  private convertLogicPhenotypeForUI(phenotype: any): any {
    if (phenotype.class_name !== 'LogicPhenotype') {
      return phenotype;
    }
    
    const expression = phenotype.expression;
    if (!expression) {
      return phenotype;
    }
    
    // Convert the ComputationGraph to logical_expression
    const logicalExpression = this.buildLogicalExpression(expression);
    
    // Create UI-compatible phenotype
    const uiPhenotype = { ...phenotype };
    uiPhenotype.logical_expression = logicalExpression;
    
    // Keep expression as well for backwards compatibility
    // but the UI will use logical_expression
    
    return uiPhenotype;
  }

  /**
   * Recursively builds a UI logical expression tree from a backend ComputationGraph.
   * Converts:
   *   - Embedded phenotype object (leaf) → LogicalExpression with phenotype_id
   *   - ComputationGraph with operator '&' → AndFilter
   *   - ComputationGraph with operator '|' → OrFilter
   */
  private buildLogicalExpression(computationGraph: any): any {
    const className = computationGraph.class_name;
    
    if (className === 'ComputationGraph') {
      // Binary operator node
      const operator = computationGraph.operator;
      const filterClass = operator === '&' ? 'AndFilter' : 'OrFilter';
      
      const filter1 = this.buildLogicalExpression(computationGraph.left);
      const filter2 = this.buildLogicalExpression(computationGraph.right);
      
      return {
        class_name: filterClass,
        filter1: filter1,
        filter2: filter2
      };
    } 
    else {
      // Leaf node - this is an actual phenotype, convert to LogicalExpression
      // The phenotype should have an id field
      if (!computationGraph.id) {
        console.warn('Phenotype in expression missing id:', computationGraph);
        return {
          class_name: 'LogicalExpression',
          phenotype_name: computationGraph.name || 'Unknown',
          phenotype_id: '',
          status: 'empty',
          id: Math.random().toString(36)
        };
      }
      
      return {
        class_name: 'LogicalExpression',
        phenotype_name: computationGraph.name || 'Unknown',
        phenotype_id: computationGraph.id,
        status: 'filled',
        id: Math.random().toString(36)
      };
    }
  }

  /**
   * Helper method to append type key to phenotypes array
   */
  private appendTypeKeyToPhenotypes(phenotypes: Array<Record<string, any>>, settype: string) {
    for (let i = 0; i < phenotypes.length; i++) {
      phenotypes[i].type = settype;
    }
  }

  // Execution progress listener management
  public addExecutionProgressListener(
    listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  ) {
    this.executionProgressListeners.push(listener);
  }

  public removeExecutionProgressListener(
    listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  ) {
    const index = this.executionProgressListeners.indexOf(listener);
    if (index > -1) {
      this.executionProgressListeners.splice(index, 1);
    }
  }

  private notifyExecutionProgressListeners(
    message: string | any,
    type: 'log' | 'error' | 'result' | 'complete'
  ) {
    this.executionProgressListeners.forEach(listener => listener(message, type));
  }
}
