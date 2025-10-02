"""
Interactive Cohort Explorer Reporter

A PhenEx Reporter for creating interactive dashboards to explore cohort phenotypes.
Built from the working callback example pattern to ensure JavaScript callbacks function
properly in both Jupyter notebooks and exported HTML files.

Usage:
    from phenex.reporting.interactive_cohort_explorer import CohortExplorer
    
    explorer = CohortExplorer(title="My Cohort Dashboard")
    result = explorer.execute(cohort)
    explorer.show()  # Display in notebook
    # OR
    explorer.export_to_html("dashboard.html")  # Export to HTML
"""

import numpy as np
import pandas as pd
from typing import Optional, Dict, List, Any
import logging

from bokeh.plotting import figure, show, save, output_file, output_notebook
from bokeh.models import (
    Select,
    CustomJS,
    ColumnDataSource,
    Div,
    HoverTool,
    FixedTicker,
    Button,
)
from bokeh.layouts import column, row, gridplot, layout
from bokeh.transform import linear_cmap
from bokeh.palettes import RdBu11, Viridis256

from phenex.reporting.reporter import Reporter

logger = logging.getLogger(__name__)


class CohortExplorer(Reporter):
    """
    Interactive dashboard for exploring cohort phenotypes and their distributions.

    This reporter creates an interactive Bokeh dashboard that allows users to:
    - Select different phenotypes from cohort.phenotypes
    - Explore VALUE column distributions with histograms
    - View timeline patterns when EVENT_DATE is available
    - Compare raw vs standardized values across phenotypes
    - Examine event frequency per patient

    The implementation follows the working callback example pattern to ensure
    JavaScript callbacks function properly in both Jupyter and exported HTML.

    Parameters:
        title: Dashboard title
        width: Dashboard width in pixels
        height: Plot height in pixels
        decimal_places: Number of decimal places for display (inherited)
        pretty_display: Use pretty formatting (inherited)
    """

    def __init__(
        self,
        title: str = "Interactive Cohort Explorer",
        width: int = 900,
        height: int = 500,
        decimal_places: int = 2,
        pretty_display: bool = True,
        show_waterfall: bool = True,
        show_timeline: bool = True,
        show_table1: bool = True,
        show_correlation: bool = True,
        show_phenotype_explorer: bool = True,
    ):
        """
        Initialize Interactive Cohort Explorer.

        Parameters:
            title: Dashboard title
            width: Dashboard width in pixels
            height: Plot height in pixels
            decimal_places: Number of decimal places for display
            pretty_display: Use pretty formatting
            show_waterfall: Include waterfall/attrition plot (default: True)
            show_timeline: Include cohort entry timeline plot (default: True)
            show_table1: Include baseline characteristics table (default: True)
            show_correlation: Include correlation heatmap (default: True)
            show_phenotype_explorer: Include interactive phenotype explorer (default: True)
        """
        super().__init__(decimal_places=decimal_places, pretty_display=pretty_display)
        print("hello")
        self.title = title
        self.width = width
        self.height = height

        # Dashboard configuration
        self.show_waterfall = show_waterfall
        self.show_timeline = show_timeline
        self.show_table1 = show_table1
        self.show_correlation = show_correlation
        self.show_phenotype_explorer = show_phenotype_explorer

        # Data containers
        self.cohort = None
        self.phenotype_data = {}
        self.waterfall_data = None
        self.table1_data = None
        self.correlation_matrix = None
        self.dashboard_layout = None

        # Color scheme - PhenEx brand colors from logo
        self.colors = {
            "histogram": "#00A9E0",  # Cyan (eye inner ring) - for main visualizations
            "timeline": "#FF6B35",  # Orange (eye outer ring) - for timeline
            "standardized": "#B4D455",  # Lime green (eye middle ring) - for standardized
            "relative_time": "#E94B3C",  # Bright red (feather) - for relative time
            "primary": "#1B365D",  # Deep blue (eye center) - primary brand
            "secondary": "#8B1538",  # Dark burgundy (feather shaft) - secondary
            "success": "#B4D455",  # Lime green - success/inclusion
            "danger": "#E94B3C",  # Bright red - danger/exclusion
            "warning": "#FF8C42",  # Orange - warning
            "accent": "#00A9E0",  # Cyan - accent color
        }

    def execute(self, cohort) -> "CohortExplorer":
        """
        Execute the interactive cohort exploration for the provided cohort.

        Parameters:
            cohort: PhenEx Cohort object with executed phenotypes

        Returns:
            Self for method chaining
        """
        logger.info(f"Creating interactive cohort explorer for cohort '{cohort.name}'")

        self.cohort = cohort

        # Check if we have phenotypes to explore
        if not cohort.phenotypes or len(cohort.phenotypes) == 0:
            logger.warning("No phenotypes found in cohort - explorer will be empty")
            self._create_empty_dashboard()
            return self

        # Generate visualization data for phenotype explorer (if enabled)
        if self.show_phenotype_explorer:
            self._generate_phenotype_data()

        # Generate additional data based on configuration
        if self.show_waterfall:
            self.waterfall_data = self._generate_waterfall_data()

        if self.show_table1:
            self.table1_data = self._generate_table1_data()

        if self.show_correlation:
            self.correlation_matrix = self._compute_correlation_matrix()

        # Build the interactive dashboard
        self._build_dashboard()

        enabled_sections = sum(
            [
                self.show_waterfall,
                self.show_timeline,
                self.show_table1,
                self.show_correlation,
                self.show_phenotype_explorer,
            ]
        )
        logger.info(
            f"Interactive cohort explorer ready with {enabled_sections} enabled sections"
        )
        return self

    def _generate_phenotype_data(self):
        """Generate visualization data from cohort.phenotypes using the VALUE column."""
        logger.debug("Generating phenotype visualization data...")

        for phenotype in self.cohort.phenotypes:
            try:
                # Check if phenotype has been executed and has data
                if not hasattr(phenotype, "table") or phenotype.table is None:
                    logger.warning(
                        f"Phenotype {phenotype.name} has no table - skipping"
                    )
                    continue

                # Convert to pandas DataFrame for analysis
                if hasattr(phenotype.table, "to_pandas"):
                    df = phenotype.table.to_pandas()
                else:
                    df = phenotype.table

                if len(df) == 0:
                    logger.warning(
                        f"Phenotype {phenotype.name} has empty table - skipping"
                    )
                    continue

                # Pre-compute all visualization types for this phenotype
                viz_data = self._compute_phenotype_visualizations(df, phenotype)

                # Determine phenotype role
                role = self._get_phenotype_role(phenotype)

                self.phenotype_data[phenotype.name] = {
                    "display_name": getattr(phenotype, "display_name", phenotype.name),
                    "type": type(phenotype).__name__,
                    "role": role,
                    "n_patients": (
                        df["PERSON_ID"].nunique() if "PERSON_ID" in df.columns else 0
                    ),
                    "n_events": len(df),
                    "has_values": len(viz_data["value_hist"]["values"]) > 0,
                    "has_dates": len(viz_data["timeline"]["x"]) > 0,
                    "viz_data": viz_data,
                }

                logger.debug(
                    f"Processed {phenotype.name}: {len(df)} events, "
                    f"values={self.phenotype_data[phenotype.name]['has_values']}, "
                    f"dates={self.phenotype_data[phenotype.name]['has_dates']}"
                )

            except Exception as e:
                logger.warning(f"Could not process phenotype {phenotype.name}: {e}")
                continue

        if not self.phenotype_data:
            logger.warning("No phenotype data could be generated")

    def _get_phenotype_role(self, phenotype) -> str:
        """Determine the role of a phenotype in the cohort."""
        # Check if it's the entry criterion
        if self.cohort.entry_criterion is phenotype:
            return "Entry"

        # Check inclusion criteria
        if phenotype in self.cohort.inclusions:
            return "Inclusion"

        # Check exclusion criteria
        if phenotype in self.cohort.exclusions:
            return "Exclusion"

        # Check outcomes
        if phenotype in self.cohort.outcomes:
            return "Outcome"

        # Check characteristics
        if phenotype in self.cohort.characteristics:
            return "Characteristic"

        raise ValueError(f"Cannot find phenotype {phenotype.name} in cohort!")

    def _compute_phenotype_visualizations(
        self, df: pd.DataFrame, phenotype
    ) -> Dict[str, Any]:
        """
        Pre-compute all visualization data for a phenotype.

        This is key to working JavaScript callbacks - all data is computed
        in Python and passed to JavaScript via CustomJS args.
        """
        viz_data = {
            "value_hist": {
                "values": [],
                "counts": [],
                "labels": [],
                "is_categorical": False,
            },
            "value_hist_std": {"values": [], "counts": []},
            "timeline": {"x": [], "y": []},
            "relative_time": {"values": [], "counts": []},
            "summary": {"mean": 0, "std": 0, "min": 0, "max": 0, "count": 0},
        }

        # 1. VALUE COLUMN HISTOGRAM (main visualization)
        if "VALUE" in df.columns:
            # Try to convert to numeric
            values_numeric = pd.to_numeric(df["VALUE"], errors="coerce")

            # Check if data is categorical (if many NaNs after conversion, or if original data is string/object)
            is_categorical = False
            original_values = df["VALUE"].dropna()

            if len(original_values) > 0:
                # Detect categorical data
                if (
                    original_values.dtype == "object"
                    or original_values.dtype.name == "category"
                ):
                    is_categorical = True
                elif values_numeric.isna().sum() > len(original_values) * 0.5:
                    # More than 50% failed to convert - likely categorical
                    is_categorical = True
                else:
                    # Check if numeric values are discrete with few unique values (likely categorical)
                    values_clean = values_numeric.dropna()
                    if len(values_clean) > 0:
                        n_unique = len(values_clean.unique())
                        # If we have fewer than 15 unique values and all values are integers, treat as categorical
                        if n_unique < 15 and all(
                            values_clean == values_clean.astype(int)
                        ):
                            is_categorical = True

                if is_categorical:
                    # Handle categorical data
                    value_counts = original_values.value_counts().sort_index()

                    # Create numeric positions for x-axis (0, 1, 2, ...)
                    positions = list(range(len(value_counts)))

                    viz_data["value_hist"] = {
                        "values": positions,
                        "counts": value_counts.values.tolist(),
                        "labels": [str(label) for label in value_counts.index.tolist()],
                        "is_categorical": True,
                    }

                    # Summary for categorical
                    viz_data["summary"] = {
                        "mean": 0,
                        "std": 0,
                        "min": 0,
                        "max": 0,
                        "count": int(len(original_values)),
                        "n_categories": len(value_counts),
                    }

                else:
                    # Handle numeric data
                    values = values_numeric.dropna()

                    if len(values) > 0:
                        # Raw value histogram
                        n_bins = min(
                            25,
                            len(values.unique()) if len(values.unique()) < 50 else 25,
                        )
                        hist, edges = np.histogram(values, bins=n_bins)
                        viz_data["value_hist"] = {
                            "values": ((edges[:-1] + edges[1:]) / 2).tolist(),
                            "counts": hist.tolist(),
                            "labels": [],
                            "is_categorical": False,
                        }

                        # Standardized histogram (0-1 scale for cross-phenotype comparison)
                        if values.std() > 0:
                            std_values = (values - values.min()) / (
                                values.max() - values.min()
                            )
                            hist_std, edges_std = np.histogram(std_values, bins=20)
                            viz_data["value_hist_std"] = {
                                "values": (
                                    (edges_std[:-1] + edges_std[1:]) / 2
                                ).tolist(),
                                "counts": hist_std.tolist(),
                            }

                        # Summary statistics
                        viz_data["summary"] = {
                            "mean": float(values.mean()),
                            "std": float(values.std()),
                            "min": float(values.min()),
                            "max": float(values.max()),
                            "count": int(len(values)),
                        }

        # 2. TIMELINE VISUALIZATION (if EVENT_DATE available)
        if "EVENT_DATE" in df.columns:
            try:
                dates = pd.to_datetime(df["EVENT_DATE"], errors="coerce").dropna()
                if len(dates) > 0:
                    # Monthly aggregation for timeline
                    monthly = dates.dt.to_period("M").value_counts().sort_index()
                    if len(monthly) > 0:
                        # Convert to JavaScript timestamps (milliseconds since epoch)
                        timestamps = [
                            int(pd.Timestamp(p.start_time).timestamp() * 1000)
                            for p in monthly.index
                        ]
                        viz_data["timeline"] = {
                            "x": timestamps,
                            "y": monthly.values.tolist(),
                        }
            except Exception as e:
                logger.debug(f"Could not process dates for {phenotype.name}: {e}")

        # 3. TIME RELATIVE TO INDEX (if EVENT_DATE and entry criterion available)
        if "EVENT_DATE" in df.columns and hasattr(self.cohort, "entry_criterion"):
            try:
                entry_criterion = self.cohort.entry_criterion
                if (
                    hasattr(entry_criterion, "table")
                    and entry_criterion.table is not None
                ):
                    # Get entry criterion table
                    if hasattr(entry_criterion.table, "to_pandas"):
                        entry_df = entry_criterion.table.to_pandas()
                    else:
                        entry_df = entry_criterion.table

                    # Ensure we have required columns
                    if (
                        "PERSON_ID" in entry_df.columns
                        and "EVENT_DATE" in entry_df.columns
                    ):
                        # Rename entry date for clarity
                        entry_df = entry_df[["PERSON_ID", "EVENT_DATE"]].copy()
                        entry_df.columns = ["PERSON_ID", "INDEX_DATE"]

                        # Inner join phenotype table with entry criterion
                        if "PERSON_ID" in df.columns:
                            joined_df = df.merge(entry_df, on="PERSON_ID", how="inner")

                            # Compute date difference in days
                            joined_df["EVENT_DATE"] = pd.to_datetime(
                                joined_df["EVENT_DATE"], errors="coerce"
                            )
                            joined_df["INDEX_DATE"] = pd.to_datetime(
                                joined_df["INDEX_DATE"], errors="coerce"
                            )

                            # Remove rows with invalid dates
                            joined_df = joined_df.dropna(
                                subset=["EVENT_DATE", "INDEX_DATE"]
                            )

                            if len(joined_df) > 0:
                                # Calculate days relative to index (positive = after, negative = before)
                                days_relative = (
                                    joined_df["EVENT_DATE"] - joined_df["INDEX_DATE"]
                                ).dt.days

                                # Create histogram of relative days
                                n_bins = min(
                                    30,
                                    (
                                        len(days_relative.unique())
                                        if len(days_relative.unique()) < 50
                                        else 30
                                    ),
                                )
                                hist, edges = np.histogram(days_relative, bins=n_bins)
                                viz_data["relative_time"] = {
                                    "values": ((edges[:-1] + edges[1:]) / 2).tolist(),
                                    "counts": hist.tolist(),
                                }
                                logger.debug(
                                    f"Computed relative time for {phenotype.name}: {len(days_relative)} events"
                                )
            except Exception as e:
                logger.debug(
                    f"Could not compute relative time for {phenotype.name}: {e}"
                )

        return viz_data

    def _generate_waterfall_data(self):
        """Generate waterfall/attrition analysis data."""
        try:
            from phenex.reporting.waterfall import Waterfall

            waterfall_reporter = Waterfall(
                decimal_places=self.decimal_places, pretty_display=self.pretty_display
            )
            waterfall_data = waterfall_reporter.execute(self.cohort)
            logger.debug(f"Generated waterfall data with {len(waterfall_data)} steps")
            return waterfall_data
        except Exception as e:
            logger.warning(f"Could not generate waterfall data: {e}")
            return pd.DataFrame()

    def _generate_table1_data(self):
        """Generate baseline characteristics (Table 1) data."""
        try:
            if self.cohort.characteristics:
                from phenex.reporting.table1 import Table1

                table1_reporter = Table1(
                    decimal_places=self.decimal_places,
                    pretty_display=self.pretty_display,
                )
                table1_data = table1_reporter.execute(self.cohort)
                logger.debug(
                    f"Generated Table1 data with {len(table1_data)} characteristics"
                )
                return table1_data
            else:
                logger.info("No characteristics defined for Table1")
                return pd.DataFrame()
        except Exception as e:
            logger.warning(f"Could not generate Table1 data: {e}")
            return pd.DataFrame()

    def _compute_correlation_matrix(self):
        """Compute correlation matrix for baseline characteristics with numeric values."""
        try:
            if not self.cohort.characteristics:
                return pd.DataFrame()

            # Collect numeric characteristic data
            char_data = {}
            for char in self.cohort.characteristics:
                if not hasattr(char, "table") or char.table is None:
                    continue

                df = (
                    char.table.to_pandas()
                    if hasattr(char.table, "to_pandas")
                    else char.table
                )

                if "VALUE" in df.columns and "PERSON_ID" in df.columns:
                    # Try to convert to numeric
                    values = pd.to_numeric(df["VALUE"], errors="coerce")
                    if values.notna().sum() > 0:
                        # Take first value per patient
                        char_values = df.groupby("PERSON_ID")["VALUE"].first()
                        char_values = pd.to_numeric(
                            char_values, errors="coerce"
                        ).dropna()
                        if len(char_values) > 0:
                            char_data[char.name] = char_values

            if len(char_data) < 2:
                logger.info("Not enough numeric characteristics for correlation matrix")
                return pd.DataFrame()

            # Create DataFrame and compute correlations
            df_chars = pd.DataFrame(char_data)
            corr_matrix = df_chars.corr()

            logger.debug(
                f"Computed correlation matrix for {len(char_data)} characteristics"
            )
            return corr_matrix

        except Exception as e:
            logger.warning(f"Could not compute correlation matrix: {e}")
            return pd.DataFrame()

    def _build_dashboard(self):
        """Build the complete interactive dashboard with working callbacks."""

        sections = []

        # Header (always shown)
        header_sections = self._create_header()
        sections.extend(header_sections)

        # Early exit if phenotype explorer disabled or no data - build minimal dashboard
        if not self.show_phenotype_explorer or not self.phenotype_data:
            self._add_static_sections(sections)
            self.dashboard_layout = column(*sections, width=self.width)
            return

        # Get list of available phenotypes
        phenotype_names = list(self.phenotype_data.keys())
        default_phenotype = phenotype_names[0]

        # Get initial visualization data to determine default mode
        initial_viz = self._get_initial_visualization(default_phenotype)

        # Determine the initial visualization mode based on what data is available
        viz_data = self.phenotype_data[default_phenotype]["viz_data"]
        if len(viz_data["value_hist"]["values"]) > 0:
            initial_viz_mode = "histogram"
        elif len(viz_data["timeline"]["x"]) > 0:
            initial_viz_mode = "timeline"
        else:
            initial_viz_mode = "histogram"  # Default even if no data

        # Create control widgets
        phenotype_select = Select(
            title="Select Characteristic:",
            value=default_phenotype,
            options=[
                (name, self.phenotype_data[name]["display_name"])
                for name in phenotype_names
            ],
            width=300,
        )

        viz_mode_select = Select(
            title="Visualization Mode:",
            value=initial_viz_mode,
            options=[
                ("histogram", "Value Distribution"),
                ("histogram_std", "Standardized Values (0-1)"),
                ("timeline", "Timeline"),
                ("relative_time", "Time Relative to Index"),
            ],
            width=250,
        )

        # Get initial visualization data
        initial_viz = self._get_initial_visualization(default_phenotype)

        # Check if categorical and add labels to source data
        viz_data = self.phenotype_data[default_phenotype]["viz_data"]
        is_categorical = viz_data["value_hist"].get("is_categorical", False)

        source_data = dict(
            x=initial_viz["x"],
            top=initial_viz["y"],
            width=[initial_viz["width"]] * len(initial_viz["y"]),
            color=[self.colors["histogram"]] * len(initial_viz["y"]),
        )

        # Add labels if categorical
        if is_categorical and viz_data["value_hist"].get("labels"):
            source_data["label"] = viz_data["value_hist"]["labels"]
        else:
            source_data["label"] = [str(x) for x in initial_viz["x"]]

        # Create plot data source with initial data
        source = ColumnDataSource(data=source_data)

        # Create main plot
        plot = figure(
            title=f"{self.phenotype_data[default_phenotype]['display_name']} - {initial_viz['title_suffix']}",
            x_axis_label=initial_viz["x_label"],
            y_axis_label="Count",
            width=self.width,
            height=self.height,
            tools="pan,wheel_zoom,box_zoom,reset,save,hover",
        )

        # Set up categorical tick labels for initial plot if needed
        if viz_data["value_hist"].get("is_categorical", False) and viz_data[
            "value_hist"
        ].get("labels"):
            from bokeh.models import FixedTicker

            # Set categorical tick labels
            category_labels = viz_data["value_hist"]["labels"]
            x_positions = viz_data["value_hist"]["values"]

            ticker = FixedTicker(ticks=x_positions)
            plot.xaxis.ticker = ticker

            # Create label overrides dictionary
            label_dict = {
                pos: label for pos, label in zip(x_positions, category_labels)
            }
            plot.xaxis.major_label_overrides = label_dict

        # Add bars to plot
        bars = plot.vbar(
            x="x",
            top="top",
            width="width",
            color="color",
            alpha=0.7,
            source=source,
            line_color="white",
            line_width=1,
        )

        # Add hover tool with category label support
        hover = HoverTool(
            renderers=[bars], tooltips=[("Value", "@label"), ("Count", "@top")]
        )
        plot.add_tools(hover)

        # Info panel showing current selection details
        info_div = Div(
            text=self._create_info_text(default_phenotype, initial_viz_mode),
            width=self.width,
        )

        # JavaScript callback using modern CustomJS interface with extensive debugging
        callback_code = """
        export default (args, obj, data, context) => {
            console.log('=== COHORT EXPLORER CALLBACK START ===');
            console.log('Callback triggered by object:', obj);
            console.log('Event data:', data);
            console.log('Context:', context);
            console.log('Arguments available:', Object.keys(args));
            
            // Extract arguments with detailed logging
            const {
                phenotype_select,
                viz_mode_select,
                source,
                plot,
                info_div,
                phenotype_data,
                colors
            } = args;
            
            console.log('phenotype_select.value:', phenotype_select.value);
            console.log('viz_mode_select.value:', viz_mode_select.value);
            console.log('Available phenotypes:', Object.keys(phenotype_data));
            console.log('Available colors:', colors);
            
            const phenotype = phenotype_select.value;
            const viz_mode = viz_mode_select.value;
            
            console.log('Selected phenotype:', phenotype);
            console.log('Selected visualization mode:', viz_mode);
            
            const pheno_info = phenotype_data[phenotype];
            
            if (!pheno_info) {
                console.error('ERROR: No data for phenotype:', phenotype);
                console.log('Available phenotypes are:', Object.keys(phenotype_data));
                return;
            }
            
            console.log('Phenotype info:', pheno_info);
            console.log('Phenotype display name:', pheno_info.display_name);
            console.log('Phenotype type:', pheno_info.type);
            console.log('Has values:', pheno_info.has_values);
            console.log('Has dates:', pheno_info.has_dates);
            
            const viz_data = pheno_info.viz_data;
            console.log('Visualization data structure:', Object.keys(viz_data));
            console.log('Value histogram data length:', viz_data.value_hist ? viz_data.value_hist.values.length : 'N/A');
            console.log('Timeline data length:', viz_data.timeline ? viz_data.timeline.x.length : 'N/A');
            console.log('Relative time data length:', viz_data.relative_time ? viz_data.relative_time.values.length : 'N/A');
            
            let x_data = [], y_data = [], title = pheno_info.display_name;
            let x_label = "Value", color = colors.histogram;
            let is_categorical = false;
            let category_labels = [];
            
            console.log('Processing visualization mode:', viz_mode);
            
            if (viz_mode === "histogram" && viz_data.value_hist.values.length > 0) {
                console.log('Using histogram mode');
                x_data = viz_data.value_hist.values;
                y_data = viz_data.value_hist.counts;
                is_categorical = viz_data.value_hist.is_categorical || false;
                category_labels = viz_data.value_hist.labels || [];
                title += " - Value Distribution";
                color = colors.histogram;
                console.log('Histogram x_data length:', x_data.length);
                console.log('Histogram y_data length:', y_data.length);
                console.log('Is categorical:', is_categorical);
                console.log('Category labels:', category_labels);
                console.log('First few x values:', x_data.slice(0, 5));
                console.log('First few y values:', y_data.slice(0, 5));
                
            } else if (viz_mode === "histogram_std" && viz_data.value_hist_std.values.length > 0) {
                console.log('Using standardized histogram mode');
                x_data = viz_data.value_hist_std.values;
                y_data = viz_data.value_hist_std.counts;
                title += " - Standardized Values (0-1)";
                x_label = "Standardized Value";
                color = colors.standardized;
                console.log('Std histogram x_data length:', x_data.length);
                console.log('Std histogram y_data length:', y_data.length);
                
            } else if (viz_mode === "timeline" && viz_data.timeline.x.length > 0) {
                console.log('Using timeline mode');
                x_data = viz_data.timeline.x;
                y_data = viz_data.timeline.y;
                title += " - Timeline";
                x_label = "Date";
                color = colors.timeline;
                console.log('Timeline x_data length:', x_data.length);
                console.log('Timeline y_data length:', y_data.length);
                console.log('First few timeline x values:', x_data.slice(0, 5));
                console.log('First few timeline y values:', y_data.slice(0, 5));
                
            } else if (viz_mode === "relative_time" && viz_data.relative_time.values.length > 0) {
                console.log('Using relative time mode');
                x_data = viz_data.relative_time.values;
                y_data = viz_data.relative_time.counts;
                title += " - Time Relative to Index";
                x_label = "Days from Index (negative = before, positive = after)";
                color = colors.relative_time;
                console.log('Relative time x_data length:', x_data.length);
                console.log('Relative time y_data length:', y_data.length);
                console.log('First few relative time x values:', x_data.slice(0, 5));
                console.log('First few relative time y values:', y_data.slice(0, 5));
                
            } else {
                console.warn('No valid data available for mode:', viz_mode);
                console.log('Available modes and their data lengths:');
                console.log('  - histogram:', viz_data.value_hist ? viz_data.value_hist.values.length : 'N/A');
                console.log('  - histogram_std:', viz_data.value_hist_std ? viz_data.value_hist_std.values.length : 'N/A');
                console.log('  - timeline:', viz_data.timeline ? viz_data.timeline.x.length : 'N/A');
                console.log('  - relative_time:', viz_data.relative_time ? viz_data.relative_time.values.length : 'N/A');
                x_data = []; 
                y_data = []; 
                title += " - No Data Available";
            }
            
            console.log('Final data arrays:');
            console.log('  x_data:', x_data);
            console.log('  y_data:', y_data);
            console.log('  title:', title);
            console.log('  x_label:', x_label);
            console.log('  color:', color);
            
            // Calculate bar width
            let width_val = 1;
            if (is_categorical) {
                // For categorical data, use uniform width of 0.8
                width_val = 0.8;
                console.log('Using categorical width_val:', width_val);
            } else if (x_data.length > 1) {
                const range = Math.max(...x_data) - Math.min(...x_data);
                width_val = range / x_data.length * 0.8;
                console.log('Calculated width_val:', width_val, 'from range:', range, 'and length:', x_data.length);
            } else {
                console.log('Using default width_val:', width_val);
            }
            
            // Update plot data (key step!)
            console.log('Current source.data before update:', source.data);
            
            // Create labels for hover tooltips
            let labels = [];
            if (is_categorical && category_labels.length > 0) {
                labels = category_labels;
            } else {
                labels = x_data.map(x => x.toFixed(2));
            }
            
            const new_data = {
                x: x_data, 
                top: y_data,
                width: Array(y_data.length).fill(width_val),
                color: Array(y_data.length).fill(color),
                label: labels
            };
            
            console.log('New source data being set:', new_data);
            source.data = new_data;
            
            console.log('Source data after update:', source.data);
            
            // Update plot properties
            console.log('Updating plot title from:', plot.title.text, 'to:', title);
            plot.title.text = title;
            
            // Update x-axis label and ticks using modern Bokeh API
            // NOTE: plot.xaxis[0] is undefined in modern Bokeh versions
            // Use plot.below[0] to access the bottom (x) axis instead
            console.log('Updating x-axis label to:', x_label);
            
            if (plot.below && plot.below.length > 0) {
                console.log('Current x-axis label:', plot.below[0].axis_label);
                plot.below[0].axis_label = x_label;
                console.log('Successfully updated x-axis label via plot.below[0]');
                
                // Handle categorical data tick labels
                if (is_categorical && category_labels.length > 0) {
                    console.log('Setting categorical tick labels:', category_labels);
                    // Use FixedTicker for categorical positions
                    const ticker = new Bokeh.FixedTicker({ticks: x_data});
                    plot.below[0].ticker = ticker;
                    
                    // Set major label overrides for categorical labels
                    const label_dict = {};
                    for (let i = 0; i < x_data.length; i++) {
                        label_dict[x_data[i]] = category_labels[i];
                    }
                    plot.below[0].major_label_overrides = label_dict;
                    console.log('Set major_label_overrides:', label_dict);
                } else {
                    // Reset to default for numeric data
                    plot.below[0].major_label_overrides = {};
                    // Reset to default ticker
                    plot.below[0].ticker = new Bokeh.BasicTicker();
                    console.log('Reset to default numeric tick labels');
                }
            } else {
                console.warn('Could not access x-axis via plot.below[0] - axis label update skipped');
            }
            
            // Update info panel
            console.log('Updating info panel...');
            let info = "<div style='background:#f8f9fa;padding:15px;border-radius:8px;'>";
            info += "<h4 style='margin:0 0 10px 0;color:#1B365D;'>" + pheno_info.display_name + "</h4>";
            info += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:15px;'>";
            info += "<div><strong>Role:</strong> " + pheno_info.role + "</div>";
            info += "<div><strong>Type:</strong> " + pheno_info.type + "</div>";
            info += "<div><strong>Patients:</strong> " + pheno_info.n_patients.toLocaleString() + "</div>";
            info += "<div><strong>Data Points:</strong> " + y_data.length + "</div>";
            
            if (viz_mode === "histogram" && viz_data.summary && viz_data.summary.count > 0) {
                console.log('Adding summary statistics to info panel');
                if (is_categorical && viz_data.summary.n_categories) {
                    info += "<div><strong>Categories:</strong> " + viz_data.summary.n_categories + "</div>";
                    info += "<div><strong>Total Values:</strong> " + viz_data.summary.count.toLocaleString() + "</div>";
                } else {
                    info += "<div><strong>Mean:</strong> " + viz_data.summary.mean.toFixed(2) + "</div>";
                    info += "<div><strong>Std:</strong> " + viz_data.summary.std.toFixed(2) + "</div>";
                }
            }
            
            info += "</div></div>";
            
            console.log('Setting info_div.text to:', info);
            info_div.text = info;
            
            console.log('=== COHORT EXPLORER CALLBACK COMPLETE ===');
        };
        """

        # Create callback with ALL required data using modern CustomJS interface
        callback = CustomJS(
            args=dict(
                phenotype_select=phenotype_select,
                viz_mode_select=viz_mode_select,
                source=source,
                plot=plot,
                info_div=info_div,
                phenotype_data=self.phenotype_data,
                colors=self.colors,
            ),
            code=callback_code,
        )

        # Register callbacks (crucial step!)
        phenotype_select.js_on_change("value", callback)
        viz_mode_select.js_on_change("value", callback)

        # Build dashboard sections
        sections = []
        header_sections = self._create_header()
        sections.extend(header_sections)

        # Add static sections (waterfall, timeline, table1, correlation)
        self._add_static_sections(sections)

        # Add Interactive Phenotype Explorer
        sections.append(
            self._create_section_header(
                "Interactive Phenotype Explorer",
                "🔍",
                "Explore individual phenotype distributions, timelines, and patterns interactively",
                section_id="phenotype-explorer",
            )
        )

        instructions = self._create_instructions()
        controls = row(phenotype_select, viz_mode_select)
        sections.append(instructions)
        sections.append(controls)
        sections.append(info_div)
        sections.append(plot)

        # Create complete dashboard layout
        self.dashboard_layout = column(*sections, width=self.width)

    def _add_static_sections(self, sections: List):
        """Add static (non-interactive) dashboard sections based on configuration."""

        # Waterfall plot (if enabled and data available)
        if (
            self.show_waterfall
            and self.waterfall_data is not None
            and not self.waterfall_data.empty
        ):
            sections.append(
                self._create_section_header(
                    "Patient Flow (Waterfall Analysis)",
                    "📊",
                    "Visualize patient attrition through inclusion and exclusion criteria",
                    section_id="waterfall",
                )
            )
            sections.append(self._create_waterfall_plot())

        # Timeline plot (if enabled)
        if self.show_timeline:
            sections.append(
                self._create_section_header(
                    "Cohort Entry Timeline",
                    "📈",
                    "Track when patients entered the cohort over time",
                    section_id="timeline",
                )
            )
            sections.append(self._create_timeline_plot())

        # Table 1 and/or Correlation Matrix (if enabled)
        has_table1 = (
            self.show_table1
            and self.table1_data is not None
            and not self.table1_data.empty
        )
        has_corr = (
            self.show_correlation
            and self.correlation_matrix is not None
            and not self.correlation_matrix.empty
        )

        if has_table1 or has_corr:
            sections.append(
                self._create_section_header(
                    "Baseline Characteristics",
                    "📋",
                    "Summary statistics and correlations for patient characteristics",
                    section_id="characteristics",
                )
            )

            if has_table1 and has_corr:
                # Show side by side
                sections.append(
                    row(
                        self._create_table1_display(),
                        self._create_correlation_heatmap(),
                    )
                )
            elif has_table1:
                sections.append(self._create_table1_display())
            elif has_corr:
                sections.append(self._create_correlation_heatmap())

        # If no sections were added, show a message
        if len(sections) == 1:  # Only header
            sections.append(
                Div(
                    text="""<div style='background:#f8f9fa;padding:30px;border-radius:8px;text-align:center;margin:20px 0;'>
                        <p style='color:#666;font-style:italic;font-size:16px;margin:0;'>No dashboard sections enabled or no data available.</p>
                        </div>"""
                )
            )

    def _get_initial_visualization(self, phenotype_name: str) -> Dict[str, Any]:
        """Get initial visualization data for the default phenotype."""
        viz_data = self.phenotype_data[phenotype_name]["viz_data"]

        # Try to get histogram data first, then timeline as fallback
        if len(viz_data["value_hist"]["values"]) > 0:
            x_data = viz_data["value_hist"]["values"]
            y_data = viz_data["value_hist"]["counts"]
            x_label = "Value"
            title_suffix = "Value Distribution"
        elif len(viz_data["timeline"]["x"]) > 0:
            x_data = viz_data["timeline"]["x"]
            y_data = viz_data["timeline"]["y"]
            x_label = "Date"
            title_suffix = "Timeline"
        elif len(viz_data["relative_time"]["values"]) > 0:
            x_data = viz_data["relative_time"]["values"]
            y_data = viz_data["relative_time"]["counts"]
            x_label = "Days from Index"
            title_suffix = "Time Relative to Index"
        else:
            x_data = [0]
            y_data = [0]
            x_label = "No Data"
            title_suffix = "No Data Available"

        # Calculate bar width
        width = 1
        if len(x_data) > 1:
            width = (max(x_data) - min(x_data)) / len(x_data) * 0.8

        return {
            "x": x_data,
            "y": y_data,
            "width": width,
            "x_label": x_label,
            "title_suffix": title_suffix,
        }

    def _create_waterfall_plot(self):
        """Create interactive waterfall/attrition plot showing cohort inclusion/exclusion flow."""
        if self.waterfall_data is None or self.waterfall_data.empty:
            return Div(
                text="<p style='color:#666;font-style:italic;'>Waterfall data not available</p>",
                width=self.width,
            )

        df = self.waterfall_data.copy()
        df["y"] = range(len(df))[::-1]  # Reverse for top-to-bottom flow

        # Color by step type - using PhenEx brand colors
        colors = []
        for step_type in df["Type"]:
            if step_type == "inclusion":
                colors.append(self.colors["success"])  # Lime green
            elif step_type == "exclusion":
                colors.append(self.colors["danger"])  # Bright red
            else:
                colors.append(self.colors["primary"])  # Deep blue
        df["color"] = colors

        p = figure(
            title="Patient Attrition Through Inclusion/Exclusion Criteria",
            x_axis_label="Number of Patients",
            y_axis_label="Criteria",
            width=self.width,
            height=max(300, len(df) * 40),
            tools="pan,wheel_zoom,box_zoom,reset,save,hover",
        )

        source = ColumnDataSource(df)
        bars = p.hbar(
            y="y",
            right="Remaining",
            height=0.7,
            source=source,
            color="color",
            alpha=0.8,
            line_color="white",
            line_width=1,
        )

        p.yaxis.ticker = list(df["y"])
        p.yaxis.major_label_overrides = dict(zip(df["y"], df["Name"]))

        hover = HoverTool(
            renderers=[bars],
            tooltips=[
                ("Criteria", "@Name"),
                ("Type", "@Type"),
                ("Remaining", "@Remaining{0,0}"),
                ("Excluded", "@N{0,0}"),
                ("% Remaining", "@{%}{0.0}%"),
            ],
        )
        p.add_tools(hover)
        p.xaxis.formatter.use_scientific = False

        return p

    def _create_timeline_plot(self):
        """Create cohort entry timeline showing patient enrollment over time."""
        try:
            if (
                not hasattr(self.cohort, "index_table")
                or self.cohort.index_table is None
            ):
                return Div(
                    text="<p style='color:#666;font-style:italic;'>Timeline data not available - no index table</p>",
                    width=self.width,
                )

            df = (
                self.cohort.index_table.to_pandas()
                if hasattr(self.cohort.index_table, "to_pandas")
                else self.cohort.index_table
            )

            if "INDEX_DATE" not in df.columns or len(df) == 0:
                return Div(
                    text="<p style='color:#666;font-style:italic;'>Timeline data not available - no index dates</p>",
                    width=self.width,
                )

            df["INDEX_DATE"] = pd.to_datetime(df["INDEX_DATE"], errors="coerce")
            df = df.dropna(subset=["INDEX_DATE"])

            if len(df) == 0:
                return Div(
                    text="<p style='color:#666;font-style:italic;'>Timeline data not available - no valid dates</p>",
                    width=self.width,
                )

            # Monthly aggregation
            df["year_month"] = df["INDEX_DATE"].dt.to_period("M")
            monthly_counts = df.groupby("year_month").size().sort_index()

            p = figure(
                title="Patient Cohort Entry Timeline",
                x_axis_label="Date",
                y_axis_label="Patients Entering Cohort",
                width=self.width,
                height=300,
                tools="pan,wheel_zoom,box_zoom,reset,save",
                x_axis_type="datetime",
            )

            timestamps = [
                pd.Timestamp(period.start_time) for period in monthly_counts.index
            ]
            source = ColumnDataSource(
                dict(
                    x=timestamps,
                    y=monthly_counts.values,
                    month=[str(p) for p in monthly_counts.index],
                )
            )

            p.line(
                "x",
                "y",
                source=source,
                line_width=3,
                color=self.colors["timeline"],
                alpha=0.8,
            )
            circles = p.scatter(
                "x",
                "y",
                source=source,
                size=8,
                color=self.colors["timeline"],
                alpha=0.9,
            )

            hover = HoverTool(
                renderers=[circles],
                tooltips=[("Month", "@month"), ("Patients", "@y{0,0}")],
            )
            p.add_tools(hover)

            return p

        except Exception as e:
            logger.warning(f"Could not create timeline plot: {e}")
            return Div(
                text=f"<p style='color:#dc3545;'>Timeline error: {str(e)}</p>",
                width=self.width,
            )

    def _create_table1_display(self):
        """Create Table 1 (baseline characteristics) display."""
        if self.table1_data is None or self.table1_data.empty:
            return Div(
                text="<p style='color:#666;font-style:italic;'>No baseline characteristics available</p>",
                width=int(self.width * 0.48),
            )

        df = self.table1_data.copy()

        # Create HTML table with all columns from Table1
        html = """
        <div style='background:#f8f9fa;padding:15px;border-radius:8px;max-height:600px;overflow-y:auto;'>
            <h3 style='margin:0 0 12px 0;color:#1B365D;font-size:16px;'>Baseline Characteristics</h3>
            <table style='width:100%;border-collapse:collapse;font-size:12px;'>
                <thead style='position:sticky;top:0;background:#1B365D;'>
                    <tr style='background:#1B365D;color:white;'>
        """

        # Add column headers dynamically
        for col in df.columns:
            html += f"<th style='padding:10px;text-align:right;border:1px solid #ddd;white-space:nowrap;'>{col}</th>"

        html += """
                    </tr>
                </thead>
                <tbody>
        """

        # Add data rows
        for idx, row in df.iterrows():
            bg_color = "#ffffff" if idx % 2 == 0 else "#f8f9fa"
            html += f"<tr style='background:{bg_color};'>"

            # First column (Name) is left-aligned, others right-aligned
            for col_idx, col in enumerate(df.columns):
                value = row[col]
                align = "left" if col_idx == 0 or col == "Name" else "right"
                # Format the value nicely
                if pd.isna(value) or value == "" or str(value) == "nan":
                    value = "-"
                html += f"<td style='padding:8px;border:1px solid #ddd;text-align:{align};'>{value}</td>"

            html += "</tr>"

        html += """
                </tbody>
            </table>
        </div>
        """

        return Div(text=html, width=int(self.width * 0.48))

    def _create_correlation_heatmap(self):
        """Create correlation heatmap for numeric baseline characteristics."""
        if self.correlation_matrix is None or self.correlation_matrix.empty:
            return Div(
                text="<p style='color:#666;font-style:italic;'>Correlation matrix not available (need 2+ numeric characteristics)</p>",
                width=self.width,
            )

        corr = self.correlation_matrix

        # Prepare data for heatmap
        characteristics = list(corr.columns)
        n = len(characteristics)

        # Create data for bokeh heatmap
        x_names = []
        y_names = []
        colors = []
        alphas = []
        corr_values = []

        for i, char_i in enumerate(characteristics):
            for j, char_j in enumerate(characteristics):
                x_names.append(char_i)
                y_names.append(char_j)
                corr_val = corr.iloc[i, j]
                corr_values.append(corr_val)
                # Color intensity based on correlation strength
                colors.append(corr_val)
                alphas.append(min(abs(corr_val), 1.0))

        source = ColumnDataSource(
            data=dict(x=x_names, y=y_names, corr=corr_values, alpha=alphas)
        )

        # Calculate size based on number of characteristics (square plot)
        size = min(int(self.width * 0.48), max(300, n * 60))

        p = figure(
            title="Correlation Matrix",
            x_range=characteristics,
            y_range=list(reversed(characteristics)),
            width=size,
            height=size,
            toolbar_location="right",
            tools="hover,save",
            x_axis_location="below",
        )

        # Create color mapper
        mapper = linear_cmap(field_name="corr", palette=RdBu11, low=-1, high=1)

        p.rect(
            x="x",
            y="y",
            width=1,
            height=1,
            source=source,
            fill_color=mapper,
            line_color=None,
        )

        # Rotate x-axis labels
        p.xaxis.major_label_orientation = 0.785  # 45 degrees

        # Configure hover
        p.select_one(HoverTool).tooltips = [
            ("Characteristics", "@x vs @y"),
            ("Correlation", "@corr{0.00}"),
        ]

        return p

    def _create_header(self) -> List[Div]:
        """Create dashboard header with banner and content underneath."""
        # Create the banner header
        banner = self._create_section_header(
            f"{self.title} - {self.cohort.name}",
            "📊",
            "Comprehensive cohort overview and study metrics",
            section_id="overview",
        )

        # Count different phenotype categories
        n_inclusions = (
            len(self.cohort.inclusions)
            if hasattr(self.cohort, "inclusions") and self.cohort.inclusions
            else 0
        )
        n_exclusions = (
            len(self.cohort.exclusions)
            if hasattr(self.cohort, "exclusions") and self.cohort.exclusions
            else 0
        )
        n_characteristics = (
            len(self.cohort.characteristics)
            if hasattr(self.cohort, "characteristics") and self.cohort.characteristics
            else 0
        )
        n_outcomes = (
            len(self.cohort.outcomes)
            if hasattr(self.cohort, "outcomes") and self.cohort.outcomes
            else 0
        )
        n_phenotypes = len(self.cohort.phenotypes)

        # Get patient count
        try:
            if (
                hasattr(self.cohort, "index_table")
                and self.cohort.index_table is not None
            ):
                if hasattr(self.cohort.index_table, "count"):
                    n_patients = self.cohort.index_table.count().execute()
                else:
                    n_patients = len(self.cohort.index_table)
            else:
                n_patients = "Unknown"
        except:
            n_patients = "Unknown"

        patient_display = (
            f"{n_patients:,}" if isinstance(n_patients, int) else str(n_patients)
        )

        # Get date range if available
        date_range_display = ""
        try:
            if (
                hasattr(self.cohort, "index_table")
                and self.cohort.index_table is not None
            ):
                if hasattr(self.cohort.index_table, "to_pandas"):
                    df = self.cohort.index_table.to_pandas()
                else:
                    df = self.cohort.index_table

                if "INDEX_DATE" in df.columns:
                    dates = pd.to_datetime(df["INDEX_DATE"], errors="coerce").dropna()
                    if len(dates) > 0:
                        min_date = dates.min().strftime("%Y-%m-%d")
                        max_date = dates.max().strftime("%Y-%m-%d")
                        date_range_display = f"""
                        <div style='background:#f8f9fa;padding:10px 15px;border-radius:8px;border-left:3px solid #00A9E0;'>
                            <strong style='color:#1B365D;'>📅 Date Range:</strong> {min_date} to {max_date}
                        </div>"""
        except Exception as e:
            logger.debug(f"Could not compute date range: {e}")

        # Get execution status
        has_entry = (
            hasattr(self.cohort, "entry_criterion")
            and self.cohort.entry_criterion is not None
        )
        execution_status = (
            "✅ Executed"
            if has_entry
            and hasattr(self.cohort, "index_table")
            and self.cohort.index_table is not None
            else "⚠️ Not Executed"
        )

        header_html = f"""
        <div style='background:linear-gradient(135deg,#1B365D 0%,#8B1538 100%);
                    color:white;padding:25px;border-radius:10px;margin-bottom:20px;box-shadow:0 4px 6px rgba(0,0,0,0.1);'>
            
            <div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:15px;'>
                <div style='background:rgba(255,255,255,0.2);padding:10px 15px;border-radius:8px;'>
                    <div style='font-size:13px;opacity:0.9;margin-bottom:4px;'>Total Patients</div>
                    <div style='font-size:24px;font-weight:700;'>📊 {patient_display}</div>
                </div>
                <div style='background:rgba(255,255,255,0.2);padding:10px 15px;border-radius:8px;'>
                    <div style='font-size:13px;opacity:0.9;margin-bottom:4px;'>Total Phenotypes</div>
                    <div style='font-size:24px;font-weight:700;'>🔬 {n_phenotypes}</div>
                </div>
                <div style='background:rgba(255,255,255,0.2);padding:10px 15px;border-radius:8px;'>
                    <div style='font-size:13px;opacity:0.9;margin-bottom:4px;'>Inclusion Criteria</div>
                    <div style='font-size:24px;font-weight:700;'>✅ {n_inclusions}</div>
                </div>
                <div style='background:rgba(255,255,255,0.2);padding:10px 15px;border-radius:8px;'>
                    <div style='font-size:13px;opacity:0.9;margin-bottom:4px;'>Exclusion Criteria</div>
                    <div style='font-size:24px;font-weight:700;'>❌ {n_exclusions}</div>
                </div>
                <div style='background:rgba(255,255,255,0.2);padding:10px 15px;border-radius:8px;'>
                    <div style='font-size:13px;opacity:0.9;margin-bottom:4px;'>Characteristics</div>
                    <div style='font-size:24px;font-weight:700;'>� {n_characteristics}</div>
                </div>
                <div style='background:rgba(255,255,255,0.2);padding:10px 15px;border-radius:8px;'>
                    <div style='font-size:13px;opacity:0.9;margin-bottom:4px;'>Outcomes</div>
                    <div style='font-size:24px;font-weight:700;'>🎯 {n_outcomes}</div>
                </div>
            </div>
            
            <div style='display:flex;gap:12px;align-items:center;flex-wrap:wrap;'>
                <div style='background:rgba(255,255,255,0.2);padding:8px 15px;border-radius:20px;font-size:14px;'>
                    <strong>Status:</strong> {execution_status}
                </div>
                {date_range_display}
            </div>
        </div>"""

        content = Div(text=header_html)
        return [banner, content]

    def _create_section_header(
        self, title: str, emoji: str, description: str = "", section_id: str = ""
    ) -> Div:
        """Create a styled section header with banner."""
        desc_html = (
            f"<p style='margin:0;color:#666;font-size:14px;'>{description}</p>"
            if description
            else ""
        )
        id_attr = f"id='{section_id}'" if section_id else ""

        header_html = f"""
        <div {id_attr} style='background:#f8f9fa;padding:20px 25px;border-radius:8px;
                    margin:30px 0 20px 0;border-left:5px solid #1B365D;
                    box-shadow:0 1px 3px rgba(0,0,0,0.08);scroll-margin-top:20px;'>
            <h2 style='margin:0 0 {8 if description else 0}px 0;font-size:24px;font-weight:600;color:#1B365D;'>
                {emoji} {title}
            </h2>
            {desc_html}
        </div>"""

        return Div(text=header_html)

    def _create_navigation_panel(self, section_ids: List) -> Div:
        """Create a collapsible navigation side panel with links to dashboard sections."""
        nav_html = """
        <div id='nav-container' style='position:sticky;top:20px;background:#f8f9fa;
                    border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.1);
                    max-height:calc(100vh - 40px);overflow:hidden;transition:all 0.3s ease;'>
            <div style='display:flex;justify-content:space-between;align-items:center;
                        padding:15px 20px;border-bottom:2px solid #00A9E0;background:#fff;
                        border-radius:10px 10px 0 0;'>
                <h3 style='margin:0;color:#1B365D;font-size:18px;font-weight:600;'>
                    🧭 Navigation
                </h3>
                <button id='nav-toggle' 
                        style='background:none;border:none;cursor:pointer;font-size:20px;
                               color:#1B365D;padding:5px;line-height:1;transition:transform 0.3s ease;'
                        onclick='toggleNav()'>
                    ◀
                </button>
            </div>
            <div id='nav-content' style='padding:20px;overflow-y:auto;max-height:calc(100vh - 120px);'>
                <ul style='list-style:none;padding:0;margin:0;'>
        """

        for section_id, section_name, is_enabled in section_ids:
            if is_enabled:
                # Create clickable navigation link
                nav_html += f"""
                <li style='margin-bottom:8px;'>
                    <a href='#{section_id}' 
                       style='display:block;padding:10px 12px;border-radius:6px;
                              text-decoration:none;color:#1B365D;font-weight:500;
                              transition:all 0.2s ease;background:white;
                              border-left:3px solid transparent;'
                       onmouseover='this.style.background="#e8f4f8";this.style.borderLeft="3px solid #00A9E0";'
                       onmouseout='this.style.background="white";this.style.borderLeft="3px solid transparent";'
                       onclick='event.preventDefault();document.getElementById("{section_id}").scrollIntoView({{behavior: "smooth", block: "start"}});'>
                        {section_name}
                    </a>
                </li>
                """

        nav_html += """
                </ul>
                <div style='margin-top:20px;padding-top:15px;border-top:1px solid #ddd;'>
                    <p style='margin:0;font-size:12px;color:#666;text-align:center;'>
                        Click to jump to section
                    </p>
                </div>
            </div>
        </div>
        <script>
        let navExpanded = true;
        
        function toggleNav() {
            const container = document.getElementById('nav-container');
            const content = document.getElementById('nav-content');
            const toggle = document.getElementById('nav-toggle');
            
            navExpanded = !navExpanded;
            
            if (navExpanded) {
                container.style.width = '220px';
                content.style.display = 'block';
                toggle.textContent = '◀';
                toggle.style.transform = 'rotate(0deg)';
            } else {
                container.style.width = '60px';
                content.style.display = 'none';
                toggle.textContent = '▶';
                toggle.style.transform = 'rotate(180deg)';
            }
        }
        </script>
        """

        return Div(text=nav_html, width=220, height=800)

    def _create_instructions(self) -> Div:
        """Create instructions panel."""
        instructions_html = """
        <div style='background:#e8f4f8;padding:15px;border-radius:8px;margin-bottom:15px;
                    border-left:5px solid #00A9E0;'>
            <p style='margin:0;'><strong>How to use:</strong> Select a phenotype from the dropdown and choose a visualization mode to explore VALUE distributions, event timelines, and temporal patterns. Hover over charts for detailed information.</p>
        </div>"""

        return Div(text=instructions_html, width=self.width)

    def _create_info_text(self, phenotype_name: str, viz_mode: str) -> str:
        """Create info panel text for a phenotype."""
        pheno_info = self.phenotype_data[phenotype_name]

        return f"""
        <div style='background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:15px;'>
            <h4 style='margin:0 0 10px 0;color:#1B365D;'>{pheno_info['display_name']}</h4>
            <div style='display:grid;grid-template-columns:1fr 1fr;gap:15px;'>
                <div><strong>Role:</strong> {pheno_info['role']}</div>
                <div><strong>Type:</strong> {pheno_info['type']}</div>
                <div><strong>Patients:</strong> {pheno_info['n_patients']:,}</div>
                <div><strong>Has Values:</strong> {'Yes' if pheno_info['has_values'] else 'No'}</div>
            </div>
        </div>"""

    def _create_empty_dashboard(self):
        """Create dashboard for when no phenotypes are available."""
        empty_html = """
        <div style='background:#fff3cd;border:1px solid #ffeaa7;color:#856404;
                    padding:30px;border-radius:8px;text-align:center;margin:20px 0;'>
            <h2 style='margin:0 0 15px 0;'>⚠️ No phenotypes Available</h2>
            <p style='margin:0 0 10px 0;'>Add phenotypes to your cohort to use the Interactive Explorer:</p>
            <code style='background:#fff;padding:8px 12px;border-radius:4px;display:inline-block;'>cohort = Cohort(name="my_cohort", phenotypes=[...], ...)</code>
        </div>"""

        header_sections = self._create_header()
        self.dashboard_layout = column(
            *header_sections, Div(text=empty_html), width=self.width
        )

    def show(self, notebook: bool = True):
        """Display the interactive dashboard."""
        if notebook:
            output_notebook()

        if hasattr(self, "dashboard_layout") and self.dashboard_layout is not None:
            show(self.dashboard_layout)
        else:
            logger.error("Dashboard not built yet. Call execute() first.")

    def export_to_html(self, filename: str = "cohort_explorer.html") -> str:
        """Export the dashboard to an HTML file."""
        if not hasattr(self, "dashboard_layout") or self.dashboard_layout is None:
            raise RuntimeError("Dashboard not built yet. Call execute() first.")

        output_file(filename)
        save(self.dashboard_layout)

        logger.info(f"Interactive cohort explorer exported to {filename}")
        return filename

    def get_phenotype_summary(self) -> pd.DataFrame:
        """Get a summary table of all phenotype data processed."""
        if not self.phenotype_data:
            return pd.DataFrame()

        summary_data = []
        for name, info in self.phenotype_data.items():
            summary_data.append(
                {
                    "Phenotype": info["display_name"],
                    "Type": info["type"],
                    "Role": info["role"],
                    "Patients": info["n_patients"],
                    "Has Values": info["has_values"],
                    "Has Dates": info["has_dates"],
                }
            )

        return pd.DataFrame(summary_data)
