import os
from phenex.filters import (
    CategoricalFilter,
    RelativeTimeRangeFilter,
    LessThan,
    GreaterThan,
    GreaterThanOrEqualTo,
    DateFilter,
)
from phenex.codelists import *
from phenex.phenotypes import *
from phenex.filters import *
import phenex.util.serialization.json as pxjson
from phenex.util.serialization.from_dict import from_dict
import datetime

PATH_ARTIFACTS = "phenex/test/serialization/artifacts"
if not os.path.exists(PATH_ARTIFACTS):
    os.mkdir(PATH_ARTIFACTS)


def test_CodelistPhenotype():
    pt = CodelistPhenotype(
        name="test",
        codelist=Codelist(name="test", codelist=["a", "b"]),
        domain="PROCEDURE_OCCURRENCE",
    )
    assertions(pt)


def test_AgePhenotype():
    pt = AgePhenotype()
    assertions(pt)


def test_SexPhenotype():
    pt = SexPhenotype()
    assertions(pt)


def test_MultipleOccurrencesPhenotype():
    study_period = DateFilter(
        min_date=AfterOrOn(datetime.date(2015, 1, 1)),
        max_date=BeforeOrOn(datetime.date(2020, 12, 31)),
    )
    phenotype = CodelistPhenotype(
        name="example_phenotype",
        domain="CONDITION_OCCURRENCE",
        codelist=Codelist(name="test", codelist=["a", "b"]),
        date_range=study_period,
        return_date="first",
    )

    pt = MultipleOccurrencesPhenotype(
        name="motest", phenotype=phenotype, n_occurrences=2, return_date="second"
    )
    assertions(pt)


def test_MeasurementPhenotype():
    ONEYEAR_PREINDEX = RelativeTimeRangeFilter(when="before", max_days=LessThan(365))
    pt = MeasurementPhenotype(
        name="measurement",
        codelist=Codelist(name="test", codelist=["a", "b"]),
        domain="observation",
        relative_time_range=ONEYEAR_PREINDEX,
        categorical_filter=CategoricalFilter(
            allowed_values=["mmHg"], column_name="UNIT"
        ),  # we set a categorical_filter to specify units
    )
    assertions(pt)


def test_DeathPhenotype():
    pt = DeathPhenotype()
    assertions(pt)


def test_CategoricalPhenotype():
    pt = CategoricalPhenotype(
        allowed_values=[1],
        column_name="ACCEPTABLE",
        domain="PERSON",
        name="data_quality",
    )
    assertions(pt)


def test_ContinuousCoveragePhenotype():
    pt = ContinuousCoveragePhenotype()
    assertions(pt)


def test_ScorePhenotype():
    c1, c2, c3 = create_three_phenotypes()

    pt1 = ScorePhenotype(
        name="scpt_simple",
        expression=c1 + c2,
        return_date="first",
    )

    pt2 = ScorePhenotype(
        name="scpt_withmultiplication",
        expression=c1 + c2 + 2 * c3,
        return_date="first",
    )

    assertions(pt1)
    assertions(pt2)


def test_ArithmeticPhenotype():
    c1, c2, c3 = create_three_phenotypes()

    pt1 = ArithmeticPhenotype(
        name="arpt_div",
        expression=c1 / c2,
        return_date="first",
    )

    pt2 = ArithmeticPhenotype(
        name="arpt_mul",
        expression=c1 * c2,
        return_date="first",
    )

    pt3 = ArithmeticPhenotype(
        name="arpt_eqt",
        expression=(c1 + c2) / c3,
        return_date="first",
    )

    assertions(pt1)
    assertions(pt2)
    assertions(pt3)


def test_LogicPhenotype():
    c1, c2, c3 = create_three_phenotypes()

    pt1 = LogicPhenotype(
        name="lgpt_or",
        expression=c1 | c2,
        return_date="first",
    )

    pt2 = LogicPhenotype(
        name="lgpt_or",
        expression=c1 & c2,
        return_date="first",
    )

    pt3 = LogicPhenotype(
        name="lgpt_or",
        expression=(c1 & c2) | c3,
        return_date="first",
    )

    assertions(pt1)
    assertions(pt2)
    assertions(pt3)


def test_cohort_serialization():
    cohort = create_cohort()
    assertions(cohort)


def assertions(obj):
    dump_load_assertion(obj)
    serialize_deserialize_assertion(obj)


def dump_load_assertion(obj):
    path = os.path.join(PATH_ARTIFACTS, obj.name + ".json")
    with open(path, "w") as f:
        pxjson.dump(obj, f, indent=4)
    with open(path, "r") as f:
        deserialized_obj = pxjson.load(f)
    assert deserialized_obj == obj


def serialize_deserialize_assertion(obj):
    serialized_obj = obj.to_dict()
    deserialized_obj = from_dict(serialized_obj)
    assert obj == deserialized_obj


def create_cohort():
    oac_codes = Codelist(
        name="anticoagulant",
        codelist=[2901677, 2],
    )

    pt1 = CodelistPhenotype(
        name="test",
        codelist=Codelist(name="test", codelist=["a", "b"]),
        domain="PROCEDURE_OCCURRENCE",
    )

    study_period = DateFilter(
        min_date=AfterOrOn(datetime.date(2015, 1, 1)),
        max_date=BeforeOrOn(datetime.date(2020, 12, 31)),
    )

    entry = CodelistPhenotype(
        name="index_oac_prescription",
        codelist=oac_codes,
        domain="CONDITION_OCCURRENCE",
        return_date="first",
        categorical_filter=CategoricalFilter(
            domain="visit", column_name="encounter_type", allowed_values=["inpatient"]
        ),
        relative_time_range=RelativeTimeRangeFilter(
            when="before",
            min_days=GreaterThan(0),
            max_days=LessThan(30),
            anchor_phenotype=pt1,
        ),
        date_range=study_period,
    )

    pt2 = CodelistPhenotype(
        return_date="first",
        codelist=Codelist(["d1"]).resolve(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )

    pt3 = CodelistPhenotype(
        name="prior_et_usage",
        codelist=Codelist(["e4"]).resolve(use_code_type=False),
        domain="DRUG_EXPOSURE",
        relative_time_range=RelativeTimeRangeFilter(
            when="before", min_days=GreaterThanOrEqualTo(0)
        ),
    )
    cohort = Cohort(
        name="test_simple_cohort_with_exclusion_and_study_period",
        entry_criterion=entry,
        inclusions=[pt2],
        exclusions=[pt3],
    )
    return cohort


def create_three_phenotypes():
    c1 = CodelistPhenotype(
        name="c1",
        codelist=Codelist(name="test", codelist=["a", "b"]),
        domain="PROCEDURE_OCCURRENCE",
    )

    c2 = CodelistPhenotype(
        name="c2",
        codelist=Codelist(name="test", codelist=["c", "d"]),
        domain="CONDITION_OCCURRENCE",
    )

    c3 = CodelistPhenotype(
        name="c3",
        codelist=Codelist(name="test", codelist=["e", "f"]),
        domain="DRUG_EXPOSURE",
    )
    return c1, c2, c3


if __name__ == "__main__":
    test_cohort_serialization()
    test_CodelistPhenotype()
    test_AgePhenotype()
    test_SexPhenotype()
    test_MultipleOccurrencesPhenotype()
    test_MeasurementPhenotype()
    test_DeathPhenotype()
    test_CategoricalPhenotype()
    test_ContinuousCoveragePhenotype()
    test_ScorePhenotype()
    test_ArithmeticPhenotype()
    test_LogicPhenotype()
