# import pytest
# import ibis
# import pandas as pd
# from datetime import date
# from phenx.filters.relative_time_range_filter import RelativeTimeRangeFilter
# from phenx.test.mock_phenotype import MockPhenotype
# from phenx.filters.value import GreaterThan, GreaterThanOrEqualTo, LessThan, LessThanOrEqualTo

# @pytest.fixture
# def setup_tables():
#     # Create a DuckDB or in-memory Ibis backend
#     con = ibis.sqlite.connect()

#     # Create a fake event table
#     event_data = {
#         "PERSON_ID": [1, 2, 3, 4, 5],
#         "EVENT_DATE": [
#             date(2020, 1, 1),
#             date(2020, 6, 15),
#             date(2020, 12, 31),
#             date(2020, 7, 20),
#             date(2020, 3, 10),
#         ],
#         "INDEX_DATE": [
#             date(2020, 1, 1),
#             date(2020, 1, 1),
#             date(2020, 1, 1),
#             date(2020, 1, 1),
#             date(2020, 1, 1),
#         ],
#     }
#     event_df = pd.DataFrame(event_data)
#     con.create_table("event_table", event_df)
#     event_table = con.table("event_table")

#     # Create a fake phenotype table
#     phenotype_data = {
#         "PERSON_ID": [1, 2, 3, 4, 5],
#         "EVENT_DATE": [
#             date(2021, 1, 1),
#             date(2021, 1, 1),
#             date(2021, 1, 1),
#             date(2021, 1, 1),
#             date(2021, 1, 1),
#         ],
#         "VALUE": [None] * 5,
#     }
#     phenotype_df = pd.DataFrame(phenotype_data)
#     con.create_table("phenotype_table", phenotype_df)
#     phenotype_table = con.table("phenotype_table")

#     tables = {"EVENT": event_table, "ANCHOR_PHENOTYPE": phenotype_table}

#     return tables

# #### Unit Tests
# def test_no_filtering(setup_tables):
#     tables = setup_tables
#     filter = RelativeTimeRangeFilter()
#     result_table = filter._filter(tables["EVENT"])
#     result_df = result_table.execute()

#     expected_person_ids = [1, 2, 3, 4, 5]
#     assert set(result_df["PERSON_ID"].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)

# def test_min_days_filtering(setup_tables):
#     tables = setup_tables
#     filter = RelativeTimeRangeFilter(min_days=GreaterThan(30))
#     result_table = filter._filter(tables["EVENT"])
#     result_df = result_table.execute()

#     expected_person_ids = [2, 3, 4, 5]
#     assert set(result_df["PERSON_ID"].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)

# def test_max_days_filtering(setup_tables):
#     tables = setup_tables
#     filter = RelativeTimeRangeFilter(max_days=LessThan(180))
#     result_table = filter._filter(tables["EVENT"])
#     result_df = result_table.execute()

#     expected_person_ids = [1, 5]
#     assert set(result_df["PERSON_ID"].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)

# def test_min_and_max_days_filtering(setup_tables):
#     tables = setup_tables
#     filter = RelativeTimeRangeFilter(min_days=GreaterThanOrEqualTo(30), max_days=LessThanOrEqualTo(180))
#     result_table = filter._filter(tables["EVENT"])
#     result_df = result_table.execute()

#     expected_person_ids = [2, 4, 5]
#     assert set(result_df["PERSON_ID"].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)

# def test_with_anchor_phenotype(setup_tables):
#     tables = setup_tables
#     anchor_phenotype = MockPhenotype(tables["ANCHOR_PHENOTYPE"])
#     filter = RelativeTimeRangeFilter(anchor_phenotype=anchor_phenotype, min_days=GreaterThan(365))
#     result_table = filter._filter(tables["EVENT"])
#     result_df = result_table.execute()

#     expected_person_ids = [1, 2, 3, 4, 5]
#     assert set(result_df["PERSON_ID"].values) == set(expected_person_ids)
#     assert len(result_df) == len(expected_person_ids)
