#!/usr/bin/env python3
"""
PhenEx Python to R Migration Script
===================================

This script converts PhenEx Python workflows to equivalent R code using the
phenexr R bindings. It supports both Python files (.py) and Jupyter notebooks
(.ipynb), with multiple output formats including R scripts, R Markdown, and Quarto.

Usage:
    python migrate_python_to_r.py input.py [output.R]
    python migrate_python_to_r.py notebook.ipynb [output.qmd]
    python migrate_python_to_r.py --interactive input.py

Features:
- Converts Python files (.py) to R scripts (.R)
- Converts Jupyter notebooks (.ipynb) to R Markdown (.Rmd) or Quarto (.qmd)
- Automatic syntax translation with manual review flagging
- Interactive mode with detailed explanations
- Preserves notebook structure including markdown cells

Author: PhenEx Development Team
"""

import ast
import re
import argparse
import sys
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set, Union
from dataclasses import dataclass


@dataclass
class ConversionRule:
    """Rule for converting Python syntax to R syntax"""

    pattern: str
    replacement: str
    description: str
    requires_manual: bool = False


class PhenexPythonToRConverter:
    """Convert PhenEx Python code to R equivalent"""

    def __init__(self):
        self.conversion_rules = self._setup_conversion_rules()
        self.import_mapping = self._setup_import_mapping()
        self.manual_review_items = []
        self.warnings = []

    def _setup_conversion_rules(self) -> List[ConversionRule]:
        """Define conversion rules for common Python to R patterns"""
        return [
            # Import statements
            ConversionRule(
                r"from phenex\.(\w+) import (\w+)",
                r"# Import: \2 <- import('phenex.\1')\n\1_module <- import('phenex.\1')",
                "Convert Python imports to R import() calls",
            ),
            ConversionRule(
                r"import phenex\.(\w+) as (\w+)",
                r"\2 <- import('phenex.\1')",
                "Convert aliased imports",
            ),
            ConversionRule(
                r"import phenex\.(\w+)",
                r"\1_module <- import('phenex.\1')",
                "Convert direct imports",
            ),
            # Class instantiation
            ConversionRule(
                r"(\w+)\(([^)]*)\)",
                r"\1(\2)",
                "Convert Python class instantiation to R (usually same syntax)",
            ),
            # Method calls - Python uses . but R uses $
            ConversionRule(
                r"(\w+)\.(\w+)\(",
                r"\1$\2(",
                "Convert Python method calls to R $ notation",
            ),
            # List creation
            ConversionRule(
                r"\[([^\]]*)\]", r"list(\1)", "Convert Python lists to R lists"
            ),
            # Dictionary creation
            ConversionRule(
                r"\{([^}]*)\}",
                r"list(\1)",
                "Convert Python dicts to R lists (manual review needed)",
                requires_manual=True,
            ),
            # Boolean values
            ConversionRule(r"\bTrue\b", "TRUE", "Convert Python True to R TRUE"),
            ConversionRule(r"\bFalse\b", "FALSE", "Convert Python False to R FALSE"),
            ConversionRule(r"\bNone\b", "NULL", "Convert Python None to R NULL"),
            # String formatting
            ConversionRule(
                r'f"([^"]*)"',
                r'paste0("\1")',
                "Convert f-strings to paste0 (manual review needed)",
                requires_manual=True,
            ),
            # Print statements
            ConversionRule(
                r"print\(([^)]*)\)", r"cat(\1, '\\n')", "Convert Python print to R cat"
            ),
            # Integer literals (Python uses 365, R prefers 365L for integers)
            ConversionRule(r"\b(\d+)\b", r"\1L", "Add L suffix to integers for R"),
            # Exception handling (basic conversion)
            ConversionRule(
                r"try:",
                r"tryCatch({",
                "Convert try block to tryCatch (manual review needed)",
                requires_manual=True,
            ),
            ConversionRule(
                r"except (\w+):",
                r"}, error = function(e) {",
                "Convert except to error handler (manual review needed)",
                requires_manual=True,
            ),
        ]

    def _setup_import_mapping(self) -> Dict[str, str]:
        """Map Python imports to R equivalents"""
        return {
            "phenex.codelists": 'codelists_module <- import("phenex.codelists")',
            "phenex.phenotypes": 'phenotypes_module <- import("phenex.phenotypes")',
            "phenex.filters": 'filters_module <- import("phenex.filters")',
            "phenex.mappers": 'mappers <- import("phenex.mappers")',
            "phenex.sim": 'sim <- import("phenex.sim")',
            "phenex.reporting": 'reporting <- import("phenex.reporting")',
            "phenex.ibis_connect": 'ibis_connect <- import("phenex.ibis_connect")',
            "datetime": 'datetime <- import("datetime")',
            "os": "# Note: os functionality typically uses Sys.setenv() in R",
            "dotenv": 'dotenv <- import("dotenv")',
        }

    def convert_file(self, input_path: str, output_path: Optional[str] = None) -> str:
        """Convert a Python file or Jupyter notebook to R"""
        input_file = Path(input_path)

        if input_file.suffix == ".ipynb":
            return self.convert_notebook(input_path, output_path)
        else:
            return self.convert_python_file(input_path, output_path)

    def convert_python_file(
        self, input_path: str, output_path: Optional[str] = None
    ) -> str:
        """Convert a Python file to R"""
        with open(input_path, "r") as f:
            python_code = f.read()

        r_code = self.convert_code(python_code)

        if output_path:
            with open(output_path, "w") as f:
                f.write(r_code)
            print(f"Converted code written to {output_path}")

        return r_code

    def convert_notebook(
        self, input_path: str, output_path: Optional[str] = None
    ) -> str:
        """Convert a Jupyter notebook to R Markdown or Quarto"""
        with open(input_path, "r", encoding="utf-8") as f:
            notebook = json.load(f)

        # Determine output format
        if output_path and (
            output_path.endswith(".qmd") or output_path.endswith(".Rmd")
        ):
            r_content = self.convert_notebook_to_rmarkdown(notebook, input_path)
        else:
            r_content = self.convert_notebook_to_r_script(notebook, input_path)

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(r_content)
            print(f"Converted notebook written to {output_path}")

        return r_content

    def convert_notebook_to_rmarkdown(self, notebook: dict, input_path: str) -> str:
        """Convert Jupyter notebook to R Markdown/Quarto format"""
        output_lines = []

        # Add YAML front matter for Quarto/R Markdown
        title = Path(input_path).stem.replace("_", " ").title()
        output_lines.extend(
            [
                "---",
                f'title: "{title}"',
                "format: html",
                "editor: visual",
                "---",
                "",
                "<!-- Converted from Jupyter notebook using PhenEx migration script -->",
                "<!-- Manual review and testing required! -->",
                "",
            ]
        )

        # Add R setup chunk
        output_lines.extend(
            [
                "```{r setup, include=FALSE}",
                "# Load required libraries",
                "library(reticulate)",
                "library(phenexr)",
                "",
                "# Initialize PhenEx",
                "phenex_result <- phenex_initialize()",
                "cat('✅ PhenEx initialization result:', phenex_result, '\\n')",
                "```",
                "",
            ]
        )

        # Process each cell
        for i, cell in enumerate(notebook.get("cells", [])):
            cell_content = self._convert_notebook_cell(cell, i + 1)
            if cell_content:
                output_lines.extend(cell_content)
                output_lines.append("")  # Add space between cells

        # Add warnings footer
        if self.warnings or self.manual_review_items:
            output_lines.extend(
                [
                    "## Migration Notes",
                    "",
                    "### Warnings and Manual Review Items",
                    "",
                ]
            )

            for warning in self.warnings:
                output_lines.append(f"- **WARNING**: {warning}")

            for item in self.manual_review_items:
                output_lines.append(f"- **MANUAL REVIEW**: {item}")

        return "\n".join(output_lines)

    def convert_notebook_to_r_script(self, notebook: dict, input_path: str) -> str:
        """Convert Jupyter notebook to R script format"""
        output_lines = []

        # Add header
        output_lines.extend(
            [
                f"# Converted from Jupyter notebook: {Path(input_path).name}",
                "# Manual review and testing required!",
                "",
                "# Load required libraries",
                "library(reticulate)",
                "library(phenexr)",
                "",
                "# Initialize PhenEx",
                "phenex_result <- phenex_initialize()",
                "cat('✅ PhenEx initialization result:', phenex_result, '\\n')",
                "",
            ]
        )

        # Process each cell
        for i, cell in enumerate(notebook.get("cells", [])):
            if cell["cell_type"] == "code":
                source = cell.get("source", [])
                if source:
                    output_lines.append(f"# Cell {i + 1} (Code)")
                    output_lines.append("# " + "-" * 40)

                    # Join source lines and convert
                    python_code = (
                        "".join(source) if isinstance(source, list) else source
                    )
                    converted_code = self._convert_cell_code(python_code, i + 1)
                    output_lines.extend(converted_code.split("\n"))
                    output_lines.append("")

            elif cell["cell_type"] == "markdown":
                source = cell.get("source", [])
                if source:
                    output_lines.append(f"# Cell {i + 1} (Markdown)")
                    output_lines.append("# " + "-" * 40)

                    # Add markdown as comments
                    markdown_text = (
                        "".join(source) if isinstance(source, list) else source
                    )
                    for line in markdown_text.split("\n"):
                        if line.strip():
                            output_lines.append(f"# {line}")
                    output_lines.append("")

        # Add warnings footer
        if self.warnings or self.manual_review_items:
            output_lines.extend(
                [
                    "",
                    "# MIGRATION WARNINGS AND MANUAL REVIEW ITEMS:",
                    "# " + "=" * 50,
                ]
            )

            for warning in self.warnings:
                output_lines.append(f"# WARNING: {warning}")

            for item in self.manual_review_items:
                output_lines.append(f"# MANUAL REVIEW: {item}")

        return "\n".join(output_lines)

    def _convert_notebook_cell(self, cell: dict, cell_num: int) -> List[str]:
        """Convert a single notebook cell to R Markdown format"""
        cell_type = cell.get("cell_type", "unknown")
        source = cell.get("source", [])

        if not source:
            return []

        # Join source lines
        content = "".join(source) if isinstance(source, list) else source

        if cell_type == "markdown":
            # Keep markdown as-is, but clean up any Python-specific references
            lines = content.split("\n")
            cleaned_lines = []
            for line in lines:
                # Replace Python-specific language hints with R
                line = re.sub(r"```python", "```{r}", line)
                line = re.sub(r"`python", "`r", line)
                cleaned_lines.append(line)
            return cleaned_lines

        elif cell_type == "code":
            converted_code = self._convert_cell_code(content, cell_num)
            return ["```{r}", converted_code, "```"]

        else:
            return [f"<!-- Unknown cell type: {cell_type} -->"]

    def _convert_cell_code(self, python_code: str, cell_num: int) -> str:
        """Convert Python code from a cell"""
        lines = python_code.split("\n")
        converted_lines = []

        for i, line in enumerate(lines):
            converted_line = self._convert_line(line, f"Cell {cell_num}, Line {i + 1}")
            converted_lines.append(converted_line)

        return "\n".join(converted_lines)

    def convert_code(self, python_code: str) -> str:
        """Convert Python code string to R"""
        lines = python_code.split("\n")
        converted_lines = []

        # Add R header
        converted_lines.extend(
            [
                "# Converted from Python to R using PhenEx migration script",
                "# Manual review and testing required!",
                "",
                "# Load required libraries",
                "library(reticulate)",
                "library(phenexr)",
                "",
                "# Initialize PhenEx",
                "phenex_result <- phenex_initialize()",
                "cat('✅ PhenEx initialization result:', phenex_result, '\\n')",
                "",
            ]
        )

        for i, line in enumerate(lines):
            converted_line = self._convert_line(line, i + 1)
            converted_lines.append(converted_line)

        # Add footer with warnings
        if self.warnings or self.manual_review_items:
            converted_lines.extend(
                [
                    "",
                    "# MIGRATION WARNINGS AND MANUAL REVIEW ITEMS:",
                    "# " + "=" * 50,
                ]
            )

            for warning in self.warnings:
                converted_lines.append(f"# WARNING: {warning}")

            for item in self.manual_review_items:
                converted_lines.append(f"# MANUAL REVIEW: {item}")

        return "\n".join(converted_lines)

    def _convert_line(self, line: str, line_num: int) -> str:
        """Convert a single line from Python to R"""
        original_line = line
        converted_line = line

        # Handle comments (keep as-is)
        if line.strip().startswith("#"):
            return line

        # Handle empty lines
        if not line.strip():
            return line

        # Handle imports specially
        if "import" in line:
            converted_line = self._convert_imports(line)
        else:
            # Apply conversion rules
            for rule in self.conversion_rules:
                if re.search(rule.pattern, converted_line):
                    new_line = re.sub(rule.pattern, rule.replacement, converted_line)
                    if new_line != converted_line:
                        converted_line = new_line
                        if rule.requires_manual:
                            self.manual_review_items.append(
                                f"Line {line_num}: {rule.description} - '{original_line.strip()}'"
                            )

        # Check for complex patterns that need manual review
        self._check_for_manual_review(converted_line, line_num, original_line)

        return converted_line

    def _convert_imports(self, line: str) -> str:
        """Convert Python import statements to R equivalents"""
        line = line.strip()

        # Handle specific PhenEx imports
        for py_import, r_import in self.import_mapping.items():
            if py_import in line:
                return r_import

        # Handle generic from imports
        match = re.match(r"from ([\w.]+) import (.+)", line)
        if match:
            module, items = match.groups()
            if "phenex" in module:
                module_var = module.split(".")[-1] + "_module"
                return f"{module_var} <- import('{module}')"

        # Handle generic direct imports
        match = re.match(r"import ([\w.]+)", line)
        if match:
            module = match.group(1)
            if "phenex" in module:
                module_var = module.split(".")[-1]
                return f"{module_var} <- import('{module}')"

        # If no specific conversion found, add a comment
        return f"# TODO: Convert import - {line}"

    def _check_for_manual_review(self, line: str, line_num: int, original: str):
        """Check for patterns that require manual review"""
        manual_patterns = [
            (r"\.iloc\[", "pandas iloc indexing needs manual conversion"),
            (r"\.loc\[", "pandas loc indexing needs manual conversion"),
            (r"lambda\s", "Lambda functions need conversion to R functions"),
            (r"with\s+", "Context managers need manual conversion"),
            (r"yield\s", "Generators not directly supported in R"),
            (r"async\s+", "Async code needs manual conversion"),
            (r"@\w+", "Python decorators need manual conversion"),
            (r"__\w+__", "Python magic methods need manual conversion"),
        ]

        for pattern, message in manual_patterns:
            if re.search(pattern, line):
                self.manual_review_items.append(
                    f"Line {line_num}: {message} - '{original.strip()}'"
                )


def main():
    parser = argparse.ArgumentParser(
        description="Convert PhenEx Python workflows to R",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Convert a Python file to R
    python migrate_python_to_r.py my_analysis.py my_analysis.R
    
    # Convert Jupyter notebook to R Markdown
    python migrate_python_to_r.py notebook.ipynb notebook.qmd
    
    # Convert Jupyter notebook to R script
    python migrate_python_to_r.py notebook.ipynb notebook.R
    
    # Convert and display output
    python migrate_python_to_r.py my_analysis.py
    
    # Interactive mode with detailed explanations
    python migrate_python_to_r.py --interactive notebook.ipynb
        """,
    )

    parser.add_argument(
        "input_file",
        help="Input Python file (.py) or Jupyter notebook (.ipynb) to convert",
    )
    parser.add_argument(
        "output_file",
        nargs="?",
        help="Output R file (.R), R Markdown (.Rmd), or Quarto (.qmd) file (optional)",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Interactive mode with detailed explanations",
    )
    parser.add_argument(
        "--preview", action="store_true", help="Preview conversion without writing file"
    )
    parser.add_argument(
        "--format",
        choices=["r", "rmd", "qmd"],
        help="Output format: r (R script), rmd (R Markdown), qmd (Quarto). Auto-detected from extension if not specified.",
    )

    args = parser.parse_args()

    if not Path(args.input_file).exists():
        print(f"Error: Input file '{args.input_file}' not found")
        sys.exit(1)

    converter = PhenexPythonToRConverter()

    try:
        if args.preview:
            r_code = converter.convert_file(args.input_file)
            print("CONVERTED R CODE:")
            print("=" * 50)
            print(r_code)
        else:
            output_file = args.output_file
            input_path = Path(args.input_file)

            if not output_file:
                # Auto-generate output filename based on input type and format preference
                if input_path.suffix == ".ipynb":
                    # Default to Quarto for notebooks
                    if args.format == "r":
                        output_file = str(input_path.with_suffix(".R"))
                    elif args.format == "rmd":
                        output_file = str(input_path.with_suffix(".Rmd"))
                    else:  # Default to .qmd for notebooks
                        output_file = str(input_path.with_suffix(".qmd"))
                else:
                    # Default to .R for Python files
                    output_file = str(input_path.with_suffix(".R"))
            else:
                # Override format based on output file extension if not explicitly set
                output_path = Path(output_file)
                if not args.format:
                    if output_path.suffix.lower() == ".rmd":
                        args.format = "rmd"
                    elif output_path.suffix.lower() == ".qmd":
                        args.format = "qmd"
                    else:
                        args.format = "r"

            r_code = converter.convert_file(args.input_file, output_file)

            print(f"✅ Conversion completed!")
            print(f"📄 Input:  {args.input_file}")
            print(f"📄 Output: {output_file}")

            # Show specific guidance based on input/output type
            input_path = Path(args.input_file)
            output_path = Path(output_file)

            if input_path.suffix == ".ipynb":
                if output_path.suffix.lower() in [".qmd", ".rmd"]:
                    print("📘 Converted Jupyter notebook to R Markdown/Quarto format")
                    print("   You can now open this in RStudio or render with Quarto")
                else:
                    print("📘 Converted Jupyter notebook to R script")
                    print("   Markdown cells have been converted to comments")

            if converter.warnings:
                print(f"⚠️  {len(converter.warnings)} warnings generated")

            if converter.manual_review_items:
                print(
                    f"🔍 {len(converter.manual_review_items)} items need manual review"
                )
                if output_path.suffix.lower() in [".qmd", ".rmd"]:
                    print(
                        "   Check the 'Migration Notes' section at the end of the document"
                    )
                else:
                    print("   Check the generated file for '# MANUAL REVIEW:' comments")

            if args.interactive:
                print("\n📋 NEXT STEPS:")
                if output_path.suffix.lower() in [".qmd", ".rmd"]:
                    print(
                        "1. Open the generated file in RStudio or a Quarto-compatible editor"
                    )
                    print("2. Review the 'Migration Notes' section")
                    print("3. Address all manual review items")
                    print(
                        "4. Run code chunks interactively or render the entire document"
                    )
                    print("5. Compare results with original notebook")
                else:
                    print("1. Review the generated R file")
                    print("2. Address all 'MANUAL REVIEW' items")
                    print("3. Test the converted code")
                    print("4. Compare results with original Python version")

    except Exception as e:
        print(f"Error during conversion: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
