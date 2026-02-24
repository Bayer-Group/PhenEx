from typing import Union, List, Optional, Dict, Any
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.phenotypes.computation_graph_phenotypes import LogicPhenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_filter import DateFilter
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.codelists import Codelist


CODETYPE_INFO = {
    "ICD-10-CM": {
        "domain": "CONDITION",
        "source": "ICD10CM",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "ICD-9-CM": {
        "domain": "CONDITION",
        "source": "ICD9CM",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "ICD-10-PCS": {
        "domain": "PROCEDURE",
        "source": "ICD10PCS",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "ICD-9-PCS": {
        "domain": "PROCEDURE",
        "source": "ICD9PCS",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "CPT": {
        "domain": "PROCEDURE",
        "source": "CPT",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "NDC": {
        "domain": "MEDICATIONDISPENSE",
        "source": "NDC",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "RxNorm": {
        "domain": "MEDICATIONDISPENSE",
        "source": "RxNorm",
        "use_code_type": True,
        "remove_punctuation": False,
    },
    "LOINC": {
        "domain": "OBSERVATION",
        "source": "LOINC",
        "use_code_type": True,
        "remove_punctuation": False,
    },
}


def SmartCodelistPhenotype(
    codelist: Codelist,
    name: Optional[str] = None,
    date_range: Optional[DateFilter] = None,
    relative_time_range: Optional[
        Union[RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]]
    ] = None,
    return_date: str = "first",
    return_value: Optional[str] = None,
    categorical_filter: Optional[CategoricalFilter] = None,
    codetype_info: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> Union[CodelistPhenotype, LogicPhenotype]:
    """
    SmartCodelistPhenotype is a factory that inspects a codelist, maps each code type to
    its corresponding domain via ``codetype_info``, and automatically constructs either a
    single :class:`CodelistPhenotype` (when all code types share one domain) or a
    :class:`LogicPhenotype` combining one :class:`CodelistPhenotype` per domain (OR logic).

    The interface is intentionally identical to :class:`CodelistPhenotype` except that
    ``domain`` is omitted – domains are derived from the code types present in *codelist*.

    Parameters:
        codelist: The codelist used for filtering. Its ``.codelist`` dict must be keyed
            by code-type strings that appear in *codetype_info* (e.g. ``"ICD-10-CM"``).
        name: The name of the resulting phenotype. Defaults to the codelist name.
        date_range: A date range filter to apply to every component phenotype.
        relative_time_range: A relative time range filter (or list) applied to every
            component phenotype.
        return_date: Specifies which event date(s) to return – ``'first'``, ``'last'``,
            ``'nearest'``, or ``'all'``. Default is ``'first'``.
        return_value: Specifies which values to return.  ``None`` or ``'all'``.
            Default is ``None``.
        categorical_filter: Additional categorical filters applied to every component
            phenotype.
        codetype_info: Mapping from code-type name to domain information. Defaults to
            :data:`CODETYPE_INFO`. Each entry must contain at least a ``'domain'`` key.
        **kwargs: Additional keyword arguments forwarded to every
            :class:`CodelistPhenotype`.

    Returns:
        A single :class:`CodelistPhenotype` when all code types map to the same domain,
        or a :class:`LogicPhenotype` (OR combination) when code types span multiple
        domains.

    Raises:
        ValueError: If a code type in *codelist* is not found in *codetype_info*.

    Examples:

    Example: Single-domain codelist (ICD codes only)
        ```python
        from phenex.phenotypes import SmartCodelistPhenotype
        from phenex.codelists import Codelist

        af_codes = Codelist(
            {"ICD-10-CM": ["I48.0", "I48.1"], "ICD-9-CM": ["427.31"]},
            name="atrial_fibrillation",
        )
        # Returns a single CodelistPhenotype on domain='CONDITION'
        af = SmartCodelistPhenotype(codelist=af_codes)
        ```

    Example: Multi-domain codelist (conditions + procedures)
        ```python
        from phenex.phenotypes import SmartCodelistPhenotype
        from phenex.codelists import Codelist

        mixed_codes = Codelist(
            {"ICD-10-CM": ["I48.0"], "CPT": ["93000"]},
            name="af_or_ecg",
        )
        # Returns a LogicPhenotype (OR) combining CONDITION and PROCEDURE phenotypes
        phenotype = SmartCodelistPhenotype(codelist=mixed_codes)
        ```
    """
    info = codetype_info if codetype_info is not None else CODETYPE_INFO
    phenotype_name = name or codelist.name

    # Group code types by domain
    domain_to_code_types: Dict[str, List[str]] = {}
    for code_type in codelist.codelist:
        if code_type is None:
            raise ValueError(
                "SmartCodelistPhenotype requires all code types to be specified "
                "(no None key). Found a None key in the codelist."
            )
        if code_type not in info:
            raise ValueError(
                f"Code type '{code_type}' not found in codetype_info. "
                f"Available code types: {list(info.keys())}"
            )
        domain = info[code_type]["domain"]
        domain_to_code_types.setdefault(domain, []).append(code_type)

    # Build one CodelistPhenotype per domain
    shared_kwargs = dict(
        date_range=date_range,
        relative_time_range=relative_time_range,
        return_date=return_date,
        return_value=return_value,
        categorical_filter=categorical_filter,
        **kwargs,
    )

    component_phenotypes = []
    for domain, code_types in domain_to_code_types.items():
        # Rename code type keys from external names (e.g. "ICD-10-CM") to source names
        # (e.g. "ICD10CM") as defined by the 'source' field in codetype_info.
        # use_punctuation=True means keep punctuation, i.e. remove_punctuation=False.
        # All code types within a domain are expected to share the same settings.
        sub_codelist_dict = {info[ct]["source"]: codelist.codelist[ct] for ct in code_types}
        use_code_type = info[code_types[0]]["use_code_type"]
        remove_punctuation = info[code_types[0]]["remove_punctuation"]
        sub_codelist = Codelist(
            sub_codelist_dict,
            name=f"{phenotype_name}_{domain.lower()}",
            use_code_type=use_code_type,
            remove_punctuation=remove_punctuation,
        )
        component_phenotypes.append(
            CodelistPhenotype(
                domain=domain,
                codelist=sub_codelist,
                name=f"{phenotype_name}_{domain.lower()}",
                **shared_kwargs,
            )
        )

    # Return single phenotype or LogicPhenotype (OR) depending on number of domains
    if len(component_phenotypes) == 1:
        # Rename to the requested name
        component_phenotypes[0].name = phenotype_name
        return component_phenotypes[0]

    # Build OR expression: p1 | p2 | p3 ...
    expression = component_phenotypes[0]
    for p in component_phenotypes[1:]:
        expression = expression | p

    return LogicPhenotype(
        expression=expression,
        return_date=return_date,
        name=phenotype_name,
    )
