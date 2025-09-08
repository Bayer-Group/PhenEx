
def create_one_inpatient_two_outpatient_phenotype(
    name_codelist,
    time_range_filter=None,
    name_phenotype=None,
    inpatient_allowed_values=["inpatient"],
    outpatient_allowed_values=["outpatient"],
    columnname_encounter_type="ENCOUNTER_TYPE",
):
    """
    A common operational definition pattern is to require a single inpatient
    visit OR two outpatient visits. This reduces misclassification error for
    example in detection of Atrial Fibrillation.
    This function creates a phenotype that implements this pattern.

    Parameters
    ----------
    name_codelist : str
        The name of the codelist to be used in the phenotype. The same codelist
        is used for in inpatient and outpatient visits.
    time_range_filter : TimeRangeFilter, optional
        A time range filter to be applied to the phenotype, for example,
        'one year before the index date'.
    name_phenotype : str, optional
        The name of the phenotype. If not provided, the name of the codelist is used
    inpatient_allowed_values : list, optional
        A list of allowed values for the inpatient visits.
    outpatient_allowed_values : list, optional
        A list of allowed values for the outpatient visits.
    columnname_encounter_type : str, optional
        The column name of the encounter type in the data source.
    """
    if name_phenotype is None:
        name_phenotype = name_codelist

    # Create single occurrence of inpatient code phenotype
    one_inpatient = CodelistPhenotype(
        name_phenotype=f"{name_phenotype}_1ip",
        name_codelist=name_codelist,
        domain="condition_occurrence",
        categorical_filter=CategoricalFilter(
            allowed_values=inpatient_allowed_values,
            columnname=columnname_encounter_type,
        )
        & CategoricalFilter(
            allowed_values=["Diagnosis of"], columnname="DIAGNOSIS_TYPE"
        ),
        time_range_filter=time_range_filter,
    )

    # Create two occurrences of outpatient code phenotype
    two_outpatient = MultipleOccurrencesPhenotype(
        name_phenotype=f"{name_phenotype}_2op",
        phenotype=CodelistPhenotype(
            name_phenotype=f"{name_phenotype}_1op",
            name_codelist=name_codelist,
            domain="condition_occurrence",
            return_date="all",
            categorical_filter=CategoricalFilter(
                allowed_values=outpatient_allowed_values,
                columnname=columnname_encounter_type,
            )
            & CategoricalFilter(
                allowed_values=["Diagnosis of"], columnname="DIAGNOSIS_TYPE"
            ),
            time_range_filter=time_range_filter,
        ),
    )

    # Create composite logical phenotype that detects either one inpatient or two outpatients
    return LogicPhenotype(
        name_phenotype=f"{name_phenotype}_1ip2op", logic=one_inpatient | two_outpatient
    )