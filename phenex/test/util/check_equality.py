import pandas as pd


def check_equality(
    result,
    expected,
    join_on=["PERSON_ID"],
    test_name="test",
    test_values=False,
    test_date=False,
):
    result = result.to_pandas()
    result.loc[:, "DUMMY"] = 1
    expected = expected.to_pandas()
    expected.loc[:, "DUMMY"] = 1

    full_results = result.merge(
        expected, on=join_on, suffixes=("_result", "_expected"), how="outer"
    )
    found_not_expected = full_results[full_results["DUMMY_expected"].isnull()]
    expected_not_found = full_results[full_results["DUMMY_result"].isnull()]

    assert (
        len(found_not_expected) == 0
    ), f"Found unexpected in test {test_name}: {found_not_expected['PERSON_ID'].values}"
    assert (
        len(expected_not_found) == 0
    ), f"Expected not found in test {test_name}: {expected_not_found['PERSON_ID'].values}"

    if test_values and "VALUE" not in join_on:
        values_match = full_results["VALUE_result"] == full_results["VALUE_expected"]
        assert (
            values_match.all()
        ), f"Found unexpected in test {test_name} : not all pairs match"
    elif test_values and "VALUE" in join_on:
        values_match = full_results["DUMMY_result"] == full_results["DUMMY_expected"]
        assert (
            values_match.all()
        ), f"Found unexpected in test {test_name} : not all pairs match"

    if test_date and "EVENT_DATE" not in join_on:
        dates_match = (
            full_results["EVENT_DATE_result"] == full_results["EVENT_DATE_expected"]
        )
        assert (
            dates_match.all()
        ), f"Found unexpected in test {test_name} : not all pairs match"
    elif test_date and "EVENT_DATE" in join_on:
        dates_match = full_results["DUMMY_result"] == full_results["DUMMY_expected"]
        assert (
            dates_match.all()
        ), f"Found unexpected in test {test_name} : not all pairs match"
