"""
Test script for constants transformation utilities.
Run with: python -m backend.utils.test_constants_transform
"""

from backend.utils.constants_transform import (
    ui_to_storage_value,
    storage_to_ui_value,
    ui_to_storage_comparator,
    storage_to_ui_comparator,
)

def test_relative_time_range_transform():
    print("Testing RelativeTimeRangeFilter transformations...")
    
    # UI format (what frontend sends)
    ui_value = {
        "class_name": "RelativeTimeRangeFilter",
        "min_days": {"class_name": "Value", "operator": ">", "value": 0},
        "max_days": {"class_name": "Value", "operator": "<", "value": 365},
        "when": "before",
        "useConstant": False,
        "useIndexDate": True,
        "anchor_phenotype": None,
    }
    
    # Transform to storage
    storage_value = ui_to_storage_value("RelativeTimeRangeFilter", ui_value)
    print(f"Storage format: {storage_value}")
    
    # Verify storage format
    assert storage_value["class_name"] == "RelativeTimeRangeFilter"
    assert storage_value["min_days"]["class_name"] == "GreaterThan"
    assert storage_value["max_days"]["class_name"] == "LessThan"
    assert "useConstant" not in storage_value
    assert "useIndexDate" not in storage_value
    
    # Transform back to UI
    ui_value_again = storage_to_ui_value("RelativeTimeRangeFilter", storage_value)
    print(f"UI format again: {ui_value_again}")
    
    # Verify round-trip
    assert ui_value_again["class_name"] == "RelativeTimeRangeFilter"
    assert ui_value_again["min_days"]["operator"] == ">"
    assert ui_value_again["max_days"]["operator"] == "<"
    assert ui_value_again["useIndexDate"] == True
    
    print("✓ RelativeTimeRangeFilter transformation successful!\n")


def test_categorical_filter_transform():
    print("Testing CategoricalFilter transformations...")
    
    # UI format
    ui_value = {
        "class_name": "CategoricalFilter",
        "column_name": "GENDER_SOURCE_VALUE",
        "operator": "isin",
        "allowed_values": ["M", "F"],
        "useConstant": False,
    }
    
    # Transform to storage
    storage_value = ui_to_storage_value("CategoricalFilter", ui_value)
    print(f"Storage format: {storage_value}")
    
    # Verify
    assert storage_value["class_name"] == "CategoricalFilter"
    assert storage_value["column_name"] == "GENDER_SOURCE_VALUE"
    assert storage_value["allowed_values"] == ["M", "F"]
    
    # Transform back
    ui_value_again = storage_to_ui_value("CategoricalFilter", storage_value)
    print(f"UI format again: {ui_value_again}")
    
    assert ui_value_again["operator"] == "isin"
    
    print("✓ CategoricalFilter transformation successful!\n")


def test_array_wrapping_issue():
    print("Testing array wrapping issue fix...")
    
    # This is the bug: UI sometimes wraps value in array
    ui_value_wrapped = [{
        "class_name": "RelativeTimeRangeFilter",
        "min_days": {"class_name": "Value", "operator": ">", "value": 0},
        "max_days": {"class_name": "Value", "operator": "<", "value": 365},
        "when": "before",
    }]
    
    # Should unwrap automatically
    storage_value = ui_to_storage_value("RelativeTimeRangeFilter", ui_value_wrapped)
    print(f"Unwrapped and transformed: {storage_value}")
    
    assert storage_value["class_name"] == "RelativeTimeRangeFilter"
    assert storage_value["min_days"]["class_name"] == "GreaterThan"
    
    print("✓ Array unwrapping successful!\n")


def test_comparator_conversions():
    print("Testing comparator conversions...")
    
    # Numeric comparators
    tests = [
        ({"class_name": "Value", "operator": ">", "value": 10}, "GreaterThan"),
        ({"class_name": "Value", "operator": ">=", "value": 10}, "GreaterThanOrEqualTo"),
        ({"class_name": "Value", "operator": "<", "value": 10}, "LessThan"),
        ({"class_name": "Value", "operator": "<=", "value": 10}, "LessThanOrEqualTo"),
    ]
    
    for ui_comp, expected_class in tests:
        storage_comp = ui_to_storage_comparator(ui_comp, "numeric")
        assert storage_comp["class_name"] == expected_class, f"Expected {expected_class}, got {storage_comp['class_name']}"
        
        # Round-trip
        ui_comp_again = storage_to_ui_comparator(storage_comp)
        assert ui_comp_again["operator"] == ui_comp["operator"]
        
    print("✓ Comparator conversions successful!\n")


if __name__ == "__main__":
    print("=" * 60)
    print("Constants Transformation Tests")
    print("=" * 60 + "\n")
    
    try:
        test_relative_time_range_transform()
        test_categorical_filter_transform()
        test_array_wrapping_issue()
        test_comparator_conversions()
        
        print("=" * 60)
        print("✓ ALL TESTS PASSED!")
        print("=" * 60)
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
