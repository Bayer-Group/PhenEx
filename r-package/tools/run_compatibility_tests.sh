#!/bin/bash
# PhenEx R-Python Compatibility Test Runner
# ========================================
#
# This script helps run the R-Python compatibility tests with proper environment setup.
# It automatically activates the Python virtual environment and runs the R test script.
#
# Usage:
#   ./run_compatibility_tests.sh [options]
#   ./run_compatibility_tests.sh --test codelist
#   ./run_compatibility_tests.sh --test cohort_workflows
#   ./run_compatibility_tests.sh --verbose

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 PhenEx R-Python Compatibility Test Runner${NC}"
echo "=============================================="

# Find the PhenEx root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHENEX_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENV_PATH="$PHENEX_ROOT/.venv"

echo -e "📂 PhenEx root: ${PHENEX_ROOT}"
echo -e "🐍 Virtual env: ${VENV_PATH}"

# Check if virtual environment exists
if [[ ! -d "$VENV_PATH" ]]; then
    echo -e "${RED}❌ Virtual environment not found at: $VENV_PATH${NC}"
    echo -e "${YELLOW}💡 Please create a virtual environment first:${NC}"
    echo -e "   cd $PHENEX_ROOT"
    echo -e "   python -m venv .venv"
    echo -e "   source .venv/bin/activate"
    echo -e "   pip install -e ."
    exit 1
fi

# Check if PhenEx is installed in the virtual environment
echo -e "${BLUE}🔍 Checking PhenEx installation...${NC}"
if ! "$VENV_PATH/bin/python" -c "import phenex" 2>/dev/null; then
    echo -e "${RED}❌ PhenEx not found in virtual environment${NC}"
    echo -e "${YELLOW}💡 Please install PhenEx:${NC}"
    echo -e "   cd $PHENEX_ROOT"
    echo -e "   source .venv/bin/activate"
    echo -e "   pip install -e ."
    exit 1
fi

echo -e "${GREEN}✅ PhenEx found in virtual environment${NC}"

# Check if R is available
if ! command -v Rscript &> /dev/null; then
    echo -e "${RED}❌ Rscript not found. Please install R.${NC}"
    exit 1
fi

# Check if required R packages are installed
echo -e "${BLUE}🔍 Checking R packages...${NC}"
Rscript -e "
required_packages <- c('reticulate', 'testthat', 'jsonlite')
missing_packages <- required_packages[!sapply(required_packages, requireNamespace, quietly = TRUE)]
if (length(missing_packages) > 0) {
  cat('❌ Missing R packages:', paste(missing_packages, collapse = ', '), '\n')
  cat('💡 Install with: install.packages(c(\"', paste(missing_packages, collapse = '\", \"'), '\"))\n')
  quit(status = 1)
} else {
  cat('✅ All required R packages found\n')
}
"

# Run the R test script with the specified Python environment
echo -e "${BLUE}🚀 Running compatibility tests...${NC}"
echo "=============================================="

cd "$SCRIPT_DIR"
Rscript test_r_python_compatibility.R --python-env "$VENV_PATH" "$@"

echo -e "${GREEN}🎉 Test run completed!${NC}"