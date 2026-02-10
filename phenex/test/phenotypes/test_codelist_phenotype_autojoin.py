"""
Test CodelistPhenotype with autojoin functionality.

This test suite validates that CodelistFilter can automatically join through
intermediate tables to reach a concept table containing CODE/CODE_TYPE columns.

Table structure:
    DummyEventWithoutCodesTable (has foreign keys, no codes)
        -> DummyEventMappingTable (intermediate mapping)
        -> DummyConceptTable (contains actual CODE/CODE_TYPE)
"""

import os
import datetime
import pandas as pd

from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import LocalCSVCodelistFactory
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.value import *
from phenex.tables import CodeTable, PhenexTable


# ============================================================================
# Mapper Definitions
# ============================================================================


class DummyConceptTable(CodeTable):
    """
    Concept table containing the actual CODE and CODE_TYPE columns.
    This is the target table that contains the codelist codes.

    Note: Must define symmetric JOIN_KEYS back to DummyEventMappingTable.
    """

    NAME_TABLE = "CONCEPT"
    JOIN_KEYS = {
        "DummyEventMappingTable": ["CONCEPTID"],  # Symmetric join to mapping table
    }
    KNOWN_FIELDS = ["CONCEPTID", "CODE", "CODE_TYPE"]
    DEFAULT_MAPPING = {
        "CONCEPTID": "CONCEPTID",
        "CODE": "CODE",
        "CODE_TYPE": "CODE_TYPE",
    }


class DummyEventMappingTable(PhenexTable):
    """
    Intermediate mapping table that links events to concepts.

    This table acts as a bridge, connecting:
    - EVENTMAPPINGID back to DummyEventWithoutCodesTable
    - CONCEPTID forward to DummyConceptTable

    Both relationships must be defined for bidirectional autojoin.
    """

    NAME_TABLE = "EVENT_MAPPING"
    JOIN_KEYS = {
        "DummyEventWithoutCodesTable": [
            "EVENTMAPPINGID"
        ],  # Symmetric join back to event table
        "DummyConceptTable": ["CONCEPTID"],  # Symmetric join forward to concept table
    }
    KNOWN_FIELDS = ["EVENTMAPPINGID", "CONCEPTID"]
    DEFAULT_MAPPING = {
        "EVENTMAPPINGID": "EVENTMAPPINGID",
        "CONCEPTID": "CONCEPTID",
    }


class DummyEventWithoutCodesTable(CodeTable):
    """
    Event table that does NOT contain CODE/CODE_TYPE directly.
    Must join through EventMapping -> Concept to reach codes.

    JOIN_KEYS: Direct join to DummyEventMappingTable using EVENTMAPPINGID
    PATHS: To reach DummyConceptTable, must go through DummyEventMappingTable
    """

    NAME_TABLE = "EVENT"
    CODES_DEFINED_IN = (
        "DummyConceptTable"  # NAME_TABLE of the table where codes are defined
    )
    JOIN_KEYS = {
        "DummyEventMappingTable": ["EVENTMAPPINGID"],  # Direct join to mapping table
    }
    PATHS = {
        "DummyConceptTable": ["DummyEventMappingTable"],  # Reach Concept via Mapping
    }
    KNOWN_FIELDS = ["PERSON_ID", "EVENT_DATE", "EVENTMAPPINGID"]
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "EVENT_DATE",
        "EVENTMAPPINGID": "EVENTMAPPINGID",
    }


# ============================================================================
# Test Generator
# ============================================================================


class CodelistPhenotypeAutojoinBasicTestGenerator(PhenotypeTestGenerator):
    """
    Basic test that validates autojoin works correctly when codes are in a
    separate concept table requiring multi-hop joins.

    This duplicates the simple CodelistPhenotypeTestGenerator logic but with
    codes stored in the concept table instead of directly on the event table.
    """

    name_space = "clpt_autojoin_basic"

    def define_input_tables(self):
        """
        Create three tables:
        1. EVENT table with PERSON_ID, EVENT_DATE, EVENTMAPPINGID
        2. EVENT_MAPPING table with EVENTMAPPINGID, CONCEPTID
        3. CONCEPT table with CONCEPTID, CODE, CODE_TYPE
        """

        # Define patients and their codes
        # P1: c1, c2, c3
        # P2: c1, c2
        # P3: c1, c3
        # P4: c1
        # P5: c2, c3
        # P6: c2
        # P7: c3
        patient_codes = {
            "P1": ["c1", "c2", "c3"],
            "P2": ["c1", "c2"],
            "P3": ["c1", "c3"],
            "P4": ["c1"],
            "P5": ["c2", "c3"],
            "P6": ["c2"],
            "P7": ["c3"],
        }

        event_date = datetime.datetime.strptime("10-10-2021", "%m-%d-%Y")

        # Build the three tables
        event_rows = []
        mapping_rows = []
        concept_rows = []

        eventmapping_id = 1
        concept_id = 1
        concept_id_map = {}  # Map code -> concept_id

        # First, create concept rows for unique codes
        unique_codes = sorted(
            set(code for codes in patient_codes.values() for code in codes)
        )
        for code in unique_codes:
            concept_rows.append(
                {
                    "CONCEPTID": concept_id,
                    "CODE": code,
                    "CODE_TYPE": "ICD10CM",
                }
            )
            concept_id_map[code] = concept_id
            concept_id += 1

        # Now create event and mapping rows
        for person_id, codes in patient_codes.items():
            for code in codes:
                # Event row (no codes, just foreign key)
                event_rows.append(
                    {
                        "PERSON_ID": person_id,
                        "EVENT_DATE": event_date,
                        "EVENTMAPPINGID": eventmapping_id,
                    }
                )

                # Mapping row (links event to concept)
                mapping_rows.append(
                    {
                        "EVENTMAPPINGID": eventmapping_id,
                        "CONCEPTID": concept_id_map[code],
                    }
                )

                eventmapping_id += 1

        df_event = pd.DataFrame(event_rows)
        df_mapping = pd.DataFrame(mapping_rows)
        df_concept = pd.DataFrame(concept_rows)

        return [
            {
                "name": "event",
                "df": df_event,
                "type": DummyEventWithoutCodesTable,
            },
            {
                "name": "event_mapping",
                "df": df_mapping,
                "type": DummyEventMappingTable,
            },
            {
                "name": "concept",
                "df": df_concept,
                "type": DummyConceptTable,
            },
        ]

    def define_phenotype_tests(self):
        """
        Define phenotype tests matching the expected patients for each codelist.
        """
        c1 = {
            "name": "c1",
            "persons": ["P1", "P2", "P3", "P4"],
        }
        c2 = {
            "name": "c2",
            "persons": ["P1", "P2", "P5", "P6"],
        }
        c3 = {
            "name": "c3",
            "persons": ["P1", "P3", "P5", "P7"],
        }
        c1c2 = {
            "name": "c1c2",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6"],
        }
        c1c3 = {
            "name": "c1c3",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P7"],
        }
        c2c3 = {
            "name": "c2c3",
            "persons": ["P1", "P2", "P3", "P5", "P6", "P7"],
        }
        c1c2c3 = {
            "name": "c1c2c3",
            "persons": ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
        }

        test_infos = [c1, c2, c3, c1c2, c1c3, c2c3, c1c2c3]
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        for test_info in test_infos:
            test_info["phenotype"] = CodelistPhenotype(
                name=test_info["name"],
                codelist=codelist_factory.get_codelist(test_info["name"]),
                domain="event",
                # Note: No need to specify codelist_domain - the DummyEventWithoutCodesTable
                # mapper defines CODES_DEFINED_IN="concept" to handle this automatically
            )

        return test_infos


class CodelistPhenotypeAutojoinTimeRangeTestGenerator(PhenotypeTestGenerator):
    """
    Test autojoin functionality with RelativeTimeRangeFilter.

    This duplicates CodelistPhenotypeRelativeTimeRangeFilterTestGenerator but
    with codes in the concept table instead of the event table.
    """

    name_space = "clpt_autojoin_timerange"

    def define_input_tables(self):
        """
        Create event data with various dates and codes in concept table.
        """
        min_days = datetime.timedelta(days=90)
        max_days = datetime.timedelta(days=180)
        one_day = datetime.timedelta(days=1)
        index_date = datetime.date(2022, 1, 1)

        event_dates = [
            index_date - min_days - one_day,  # P0
            index_date - min_days,  # P1
            index_date - min_days + one_day,  # P2
            index_date - max_days - one_day,  # P3
            index_date - max_days,  # P4
            index_date - max_days + one_day,  # P5
            index_date - one_day,  # P6
            index_date,  # P7
            index_date + one_day,  # P8
            index_date + min_days + one_day,  # P9
            index_date + min_days,  # P10
            index_date + min_days - one_day,  # P11
            index_date + max_days + one_day,  # P12
            index_date + max_days,  # P13
            index_date + max_days - one_day,  # P14
        ]
        N = len(event_dates)

        # Create concept table with one code
        df_concept = pd.DataFrame(
            {
                "CONCEPTID": [1],
                "CODE": ["c1"],
                "CODE_TYPE": ["ICD10CM"],
            }
        )

        # Create event mapping table
        df_mapping = pd.DataFrame(
            {
                "EVENTMAPPINGID": list(range(1, N + 1)),
                "CONCEPTID": [1] * N,  # All map to concept 1 (c1)
            }
        )

        # Create event table (no codes)
        df_event = pd.DataFrame(
            {
                "PERSON_ID": [f"P{x}" for x in list(range(N))],
                "EVENT_DATE": event_dates,
                "EVENTMAPPINGID": list(range(1, N + 1)),
                "INDEX_DATE": [index_date] * N,
            }
        )

        return [
            {"name": "event", "df": df_event, "type": DummyEventWithoutCodesTable},
            {"name": "event_mapping", "df": df_mapping, "type": DummyEventMappingTable},
            {"name": "concept", "df": df_concept, "type": DummyConceptTable},
        ]

    def define_phenotype_tests(self):
        """
        Define time range tests using autojoin to concept table.
        """
        t1 = {
            "name": "max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                max_days=LessThanOrEqualTo(180)
            ),
            "persons": ["P0", "P1", "P2", "P4", "P5", "P6", "P7"],
        }
        t2 = {
            "name": "max_days_lt_180",
            "relative_time_range": RelativeTimeRangeFilter(max_days=LessThan(180)),
            "persons": ["P0", "P1", "P2", "P5", "P6", "P7"],
        }
        t3 = {
            "name": "min_days_geq_90_max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThanOrEqualTo(90),
                max_days=LessThanOrEqualTo(180),
            ),
            "persons": ["P0", "P1", "P4", "P5"],
        }
        t4 = {
            "name": "after_max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                max_days=LessThanOrEqualTo(180), when="after"
            ),
            "persons": ["P7", "P8", "P9", "P10", "P11", "P13", "P14"],
        }
        t5 = {
            "name": "after_max_days_g_90_max_days_leq_180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(90),
                max_days=LessThanOrEqualTo(180),
                when="after",
            ),
            "persons": ["P9", "P13", "P14"],
        }
        t6 = {
            "name": "range_min_gn90_max_g90",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(-90), max_days=LessThan(90), when="after"
            ),
            "persons": ["P2", "P6", "P7", "P8", "P11"],
        }
        t7 = {
            "name": "range_min_gn90_max_ge180",
            "relative_time_range": RelativeTimeRangeFilter(
                min_days=GreaterThan(-90),
                max_days=LessThanOrEqualTo(180),
                when="after",
            ),
            "persons": ["P2", "P6", "P7", "P8", "P9", "P10", "P11", "P13", "P14"],
        }

        test_infos = [t1, t2, t3, t4, t5, t6, t7]
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        for test_info in test_infos:
            test_info["phenotype"] = CodelistPhenotype(
                name=test_info["name"],
                codelist=codelist_factory.get_codelist("c1"),
                domain="event",
                # Note: CODES_DEFINED_IN="concept" in mapper handles autojoin automatically
                relative_time_range=test_info["relative_time_range"],
            )

        return test_infos


# ============================================================================
# Test Registration
# ============================================================================


# ============================================================================
# Asymmetric Join Keys Test
# ============================================================================


class AsymmetricConceptTable(CodeTable):
    """
    Concept table with ID column (asymmetric naming pattern).
    Foreign keys in other tables will reference this as CONCEPTID.
    """

    NAME_TABLE = "CONCEPT_ASYM"
    JOIN_KEYS = {
        "AsymmetricEventMappingTable": ["ID", "CONCEPTID"],  # Asymmetric: ID -> CONCEPTID
    }
    KNOWN_FIELDS = ["PERSON_ID", "EVENT_DATE", "CODE", "CODE_TYPE", "ID"]
    DEFAULT_MAPPING = {
        "ID": "ID",  # Needed for joins
        "CODE": "CODE",
        "CODE_TYPE": "CODE_TYPE",
    }


class AsymmetricEventMappingTable(PhenexTable):
    """
    Mapping table with foreign keys using [TABLENAME]ID pattern.
    - EVENTID references AsymmetricEventTable.ID
    - CONCEPTID references AsymmetricConceptTable.ID
    """

    NAME_TABLE = "EVENT_MAPPING_ASYM"
    JOIN_KEYS = {
        "AsymmetricEventTable": ["EVENTID", "ID"],  # Asymmetric: EVENTID -> ID
        "AsymmetricConceptTable": ["CONCEPTID", "ID"],  # Asymmetric: CONCEPTID -> ID
    }
    KNOWN_FIELDS = ["EVENTID", "CONCEPTID"]
    DEFAULT_MAPPING = {
        "EVENTID": "EVENTID",  # Needed for joins
        "CONCEPTID": "CONCEPTID",  # Needed for joins
    }


class AsymmetricEventTable(CodeTable):
    """
    Event table with ID column.
    Foreign keys in mapping table reference this as EVENTID.
    """

    NAME_TABLE = "EVENT_ASYM"
    CODES_DEFINED_IN = "CONCEPT_ASYM"
    JOIN_KEYS = {
        "AsymmetricEventMappingTable": ["ID", "EVENTID"],  # Asymmetric: ID -> EVENTID
    }
    PATHS = {
        "AsymmetricConceptTable": ["AsymmetricEventMappingTable"],
    }
    KNOWN_FIELDS = ["PERSON_ID", "EVENT_DATE", "ID"]
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "EVENT_DATE",
        "ID": "ID",  # Needed for joins
    }


class CodelistPhenotypeAutojoinAsymmetricTestGenerator(PhenotypeTestGenerator):
    """
    Test autojoin with asymmetric join keys where table uses ID column
    but foreign keys use [TABLENAME]ID pattern.
    """

    name_space = "clpt_autojoin_asymmetric"

    def define_input_tables(self):
        """
        Create three tables with asymmetric join keys:
        1. EVENT_ASYM: Has ID column
        2. EVENT_MAPPING_ASYM: Has EVENTID (FK to EVENT) and CONCEPTID (FK to CONCEPT)
        3. CONCEPT_ASYM: Has ID column
        """
        patient_codes = {
            "P1": ["c1", "c2", "c3"],
            "P2": ["c1", "c2"],
            "P3": ["c1", "c3"],
            "P4": ["c1"],
        }

        event_date = datetime.datetime.strptime("10-10-2021", "%m-%d-%Y")

        event_rows = []
        mapping_rows = []
        concept_rows = []

        event_id = 1
        concept_id = 1
        concept_id_map = {}

        # Create concept rows
        unique_codes = sorted(
            set(code for codes in patient_codes.values() for code in codes)
        )
        for code in unique_codes:
            concept_rows.append(
                {
                    "ID": concept_id,  # Asymmetric: table uses ID
                    "CODE": code,
                    "CODE_TYPE": "ICD10CM",
                }
            )
            concept_id_map[code] = concept_id
            concept_id += 1

        # Create event and mapping rows
        for person_id, codes in patient_codes.items():
            for code in codes:
                event_rows.append(
                    {
                        "PERSON_ID": person_id,
                        "EVENT_DATE": event_date,
                        "ID": event_id,  # Asymmetric: table uses ID
                    }
                )

                mapping_rows.append(
                    {
                        "EVENTID": event_id,  # Asymmetric: FK uses EVENTID
                        "CONCEPTID": concept_id_map[code],  # Asymmetric: FK uses CONCEPTID
                    }
                )

                event_id += 1

        df_event = pd.DataFrame(event_rows)
        df_mapping = pd.DataFrame(mapping_rows)
        df_concept = pd.DataFrame(concept_rows)

        return [
            {
                "name": "event_asym",
                "df": df_event,
                "type": AsymmetricEventTable,
            },
            {
                "name": "event_mapping_asym",
                "df": df_mapping,
                "type": AsymmetricEventMappingTable,
            },
            {
                "name": "concept_asym",
                "df": df_concept,
                "type": AsymmetricConceptTable,
            },
        ]

    def define_phenotype_tests(self):
        """
        Test that asymmetric joins work correctly.
        """
        c1 = {
            "name": "c1_asym",
            "persons": ["P1", "P2", "P3", "P4"],
        }
        c2 = {
            "name": "c2_asym",
            "persons": ["P1", "P2"],
        }
        c3 = {
            "name": "c3_asym",
            "persons": ["P1", "P3"],
        }

        test_infos = [c1, c2, c3]
        codelist_factory = LocalCSVCodelistFactory(
            os.path.join(os.path.dirname(__file__), "../util/dummy/codelists.csv")
        )

        for test_info in test_infos:
            codelist_name = test_info["name"].replace("_asym", "")
            test_info["phenotype"] = CodelistPhenotype(
                name=test_info["name"],
                codelist=codelist_factory.get_codelist(codelist_name),
                domain="event_asym",
            )

        return test_infos


# ============================================================================
# Test Registration
# ============================================================================

if __name__ == "__main__":
    import sys

    # Basic autojoin test
    basic_gen = CodelistPhenotypeAutojoinBasicTestGenerator()
    basic_gen.run_tests()

    # Time range autojoin test
    timerange_gen = CodelistPhenotypeAutojoinTimeRangeTestGenerator()
    timerange_gen.run_tests()

    # Asymmetric join keys test
    asymmetric_gen = CodelistPhenotypeAutojoinAsymmetricTestGenerator()
    asymmetric_gen.run_tests()

    print("\n" + "=" * 80)
    print("All CodelistPhenotype autojoin tests completed successfully!")
    print("=" * 80)
