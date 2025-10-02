"""
Interactive Cohort Explorer Reporter

A PhenEx Reporter for creating interactive dashboards to explore cohort phenotypes.
Built from the working callback example pattern to ensure JavaScript callbacks function
properly in both Jupyter notebooks and exported HTML files.

Usage:
    from phenex.reporting.interactive_cohort_explorer import InteractiveCohortExplorer
    
    explorer = InteractiveCohortExplorer(title="My Cohort Dashboard")
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
from bokeh.models import Select, CustomJS, ColumnDataSource, Div, HoverTool
from bokeh.layouts import column, row

from phenex.reporting.reporter import Reporter

logger = logging.getLogger(__name__)


class InteractiveCohortExplorer(Reporter):
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
        pretty_display: bool = True
    ):
        super().__init__(decimal_places=decimal_places, pretty_display=pretty_display)
        
        self.title = title
        self.width = width
        self.height = height
        
        # Data containers
        self.cohort = None
        self.phenotype_data = {}
        self.dashboard_layout = None
        
        # Color scheme
        self.colors = {
            'histogram': '#1f77b4',
            'timeline': '#ff7f0e', 
            'frequency': '#2ca02c',
            'standardized': '#9467bd'
        }
        
    def execute(self, cohort) -> "InteractiveCohortExplorer":
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
            
        # Generate visualization data for all phenotypes
        self._generate_phenotype_data()
        
        # Build the interactive dashboard
        self._build_dashboard()
        
        logger.info(f"Interactive cohort explorer ready with {len(self.phenotype_data)} phenotypes")
        return self
        
    def _generate_phenotype_data(self):
        """Generate visualization data from cohort.phenotypes using the VALUE column."""
        logger.debug("Generating phenotype visualization data...")
        
        for phenotype in self.cohort.phenotypes:
            try:
                # Check if phenotype has been executed and has data
                if not hasattr(phenotype, 'table') or phenotype.table is None:
                    logger.warning(f"Phenotype {phenotype.name} has no table - skipping")
                    continue
                    
                # Convert to pandas DataFrame for analysis
                if hasattr(phenotype.table, 'to_pandas'):
                    df = phenotype.table.to_pandas()
                else:
                    df = phenotype.table
                    
                if len(df) == 0:
                    logger.warning(f"Phenotype {phenotype.name} has empty table - skipping")
                    continue
                    
                # Pre-compute all visualization types for this phenotype
                viz_data = self._compute_phenotype_visualizations(df, phenotype)
                
                self.phenotype_data[phenotype.name] = {
                    'display_name': getattr(phenotype, 'display_name', phenotype.name),
                    'type': type(phenotype).__name__,
                    'n_patients': df['PERSON_ID'].nunique() if 'PERSON_ID' in df.columns else 0,
                    'n_events': len(df),
                    'has_values': len(viz_data['value_hist']['values']) > 0,
                    'has_dates': len(viz_data['timeline']['x']) > 0,
                    'viz_data': viz_data
                }
                
                logger.debug(f"Processed {phenotype.name}: {len(df)} events, "
                           f"values={self.phenotype_data[phenotype.name]['has_values']}, "
                           f"dates={self.phenotype_data[phenotype.name]['has_dates']}")
                           
            except Exception as e:
                logger.warning(f"Could not process phenotype {phenotype.name}: {e}")
                continue
                
        if not self.phenotype_data:
            logger.warning("No phenotype data could be generated")
            
    def _compute_phenotype_visualizations(self, df: pd.DataFrame, phenotype) -> Dict[str, Any]:
        """
        Pre-compute all visualization data for a phenotype.
        
        This is key to working JavaScript callbacks - all data is computed
        in Python and passed to JavaScript via CustomJS args.
        """
        viz_data = {
            'value_hist': {'values': [], 'counts': []},
            'value_hist_std': {'values': [], 'counts': []},
            'timeline': {'x': [], 'y': []},
            'frequency': {'values': [], 'counts': []},
            'summary': {'mean': 0, 'std': 0, 'min': 0, 'max': 0, 'count': 0}
        }
        
        # 1. VALUE COLUMN HISTOGRAM (main visualization)
        if 'VALUE' in df.columns:
            values = pd.to_numeric(df['VALUE'], errors='coerce').dropna()
            
            if len(values) > 0:
                # Raw value histogram
                n_bins = min(25, len(values.unique()) if len(values.unique()) < 50 else 25)
                hist, edges = np.histogram(values, bins=n_bins)
                viz_data['value_hist'] = {
                    'values': ((edges[:-1] + edges[1:]) / 2).tolist(),
                    'counts': hist.tolist()
                }
                
                # Standardized histogram (0-1 scale for cross-phenotype comparison)
                if values.std() > 0:
                    std_values = (values - values.min()) / (values.max() - values.min())
                    hist_std, edges_std = np.histogram(std_values, bins=20)
                    viz_data['value_hist_std'] = {
                        'values': ((edges_std[:-1] + edges_std[1:]) / 2).tolist(),
                        'counts': hist_std.tolist()
                    }
                
                # Summary statistics
                viz_data['summary'] = {
                    'mean': float(values.mean()),
                    'std': float(values.std()),
                    'min': float(values.min()),
                    'max': float(values.max()),
                    'count': int(len(values))
                }
                
        # 2. TIMELINE VISUALIZATION (if EVENT_DATE available)
        if 'EVENT_DATE' in df.columns:
            try:
                dates = pd.to_datetime(df['EVENT_DATE'], errors='coerce').dropna()
                if len(dates) > 0:
                    # Monthly aggregation for timeline
                    monthly = dates.dt.to_period('M').value_counts().sort_index()
                    if len(monthly) > 0:
                        # Convert to JavaScript timestamps (milliseconds since epoch)
                        timestamps = [int(pd.Timestamp(p.start_time).timestamp() * 1000) 
                                    for p in monthly.index]
                        viz_data['timeline'] = {
                            'x': timestamps,
                            'y': monthly.values.tolist()
                        }
            except Exception as e:
                logger.debug(f"Could not process dates for {phenotype.name}: {e}")
                
        # 3. EVENT FREQUENCY PER PATIENT
        if 'PERSON_ID' in df.columns:
            try:
                patient_counts = df.groupby('PERSON_ID').size()
                hist, edges = np.histogram(patient_counts, bins=min(15, len(patient_counts.unique())))
                viz_data['frequency'] = {
                    'values': ((edges[:-1] + edges[1:]) / 2).tolist(),
                    'counts': hist.tolist()
                }
            except Exception as e:
                logger.debug(f"Could not compute frequency for {phenotype.name}: {e}")
                
        return viz_data
        
    def _build_dashboard(self):
        """Build the complete interactive dashboard with working callbacks."""
        
        if not self.phenotype_data:
            self._create_empty_dashboard()
            return
            
        # Get list of available phenotypes
        phenotype_names = list(self.phenotype_data.keys())
        default_phenotype = phenotype_names[0]
        
        # Create control widgets
        phenotype_select = Select(
            title="Select Characteristic:",
            value=default_phenotype,
            options=[(name, self.phenotype_data[name]['display_name']) 
                    for name in phenotype_names],
            width=300
        )
        
        viz_mode_select = Select(
            title="Visualization Mode:",
            value="histogram",
            options=[
                ("histogram", "Value Distribution"),
                ("histogram_std", "Standardized Values (0-1)"),
                ("timeline", "Timeline"),
                ("frequency", "Events per Patient")
            ],
            width=250
        )
        
        # Get initial visualization data
        initial_viz = self._get_initial_visualization(default_phenotype)
        
        # Create plot data source with initial data
        source = ColumnDataSource(data=dict(
            x=initial_viz['x'],
            top=initial_viz['y'],
            width=[initial_viz['width']] * len(initial_viz['y']),
            color=[self.colors['histogram']] * len(initial_viz['y'])
        ))
        
        # Create main plot
        plot = figure(
            title=f"{self.phenotype_data[default_phenotype]['display_name']} - Value Distribution",
            x_axis_label=initial_viz['x_label'],
            y_axis_label="Count",
            width=self.width,
            height=self.height,
            tools="pan,wheel_zoom,box_zoom,reset,save,hover"
        )
        
        # Add bars to plot
        bars = plot.vbar(
            x='x', top='top', width='width', color='color',
            alpha=0.7, source=source, line_color='white', line_width=1
        )
        
        # Add hover tool
        hover = HoverTool(
            renderers=[bars],
            tooltips=[("Value", "@x{0.00}"), ("Count", "@top")]
        )
        plot.add_tools(hover)
        
        # Info panel showing current selection details
        info_div = Div(
            text=self._create_info_text(default_phenotype, "histogram"),
            width=self.width
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
            console.log('Frequency data length:', viz_data.frequency ? viz_data.frequency.values.length : 'N/A');
            
            let x_data = [], y_data = [], title = pheno_info.display_name;
            let x_label = "Value", color = colors.histogram;
            
            console.log('Processing visualization mode:', viz_mode);
            
            if (viz_mode === "histogram" && viz_data.value_hist.values.length > 0) {
                console.log('Using histogram mode');
                x_data = viz_data.value_hist.values;
                y_data = viz_data.value_hist.counts;
                title += " - Value Distribution";
                color = colors.histogram;
                console.log('Histogram x_data length:', x_data.length);
                console.log('Histogram y_data length:', y_data.length);
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
                
            } else if (viz_mode === "frequency" && viz_data.frequency.values.length > 0) {
                console.log('Using frequency mode');
                x_data = viz_data.frequency.values;
                y_data = viz_data.frequency.counts;
                title += " - Events per Patient";
                x_label = "Events per Patient";
                color = colors.frequency;
                console.log('Frequency x_data length:', x_data.length);
                console.log('Frequency y_data length:', y_data.length);
                
            } else {
                console.warn('No valid data available for mode:', viz_mode);
                console.log('Available modes and their data lengths:');
                console.log('  - histogram:', viz_data.value_hist ? viz_data.value_hist.values.length : 'N/A');
                console.log('  - histogram_std:', viz_data.value_hist_std ? viz_data.value_hist_std.values.length : 'N/A');
                console.log('  - timeline:', viz_data.timeline ? viz_data.timeline.x.length : 'N/A');
                console.log('  - frequency:', viz_data.frequency ? viz_data.frequency.values.length : 'N/A');
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
            if (x_data.length > 1) {
                const range = Math.max(...x_data) - Math.min(...x_data);
                width_val = range / x_data.length * 0.8;
                console.log('Calculated width_val:', width_val, 'from range:', range, 'and length:', x_data.length);
            } else {
                console.log('Using default width_val:', width_val);
            }
            
            // Update plot data (key step!)
            console.log('Current source.data before update:', source.data);
            
            const new_data = {
                x: x_data, 
                top: y_data,
                width: Array(y_data.length).fill(width_val),
                color: Array(y_data.length).fill(color)
            };
            
            console.log('New source data being set:', new_data);
            source.data = new_data;
            
            console.log('Source data after update:', source.data);
            
            // Update plot properties
            console.log('Updating plot title from:', plot.title.text, 'to:', title);
            plot.title.text = title;
            
            // Update x-axis label using modern Bokeh API
            // NOTE: plot.xaxis[0] is undefined in modern Bokeh versions
            // Use plot.below[0] to access the bottom (x) axis instead
            console.log('Updating x-axis label to:', x_label);
            
            if (plot.below && plot.below.length > 0) {
                console.log('Current x-axis label:', plot.below[0].axis_label);
                plot.below[0].axis_label = x_label;
                console.log('Successfully updated x-axis label via plot.below[0]');
            } else {
                console.warn('Could not access x-axis via plot.below[0] - axis label update skipped');
            }
            
            // Update info panel
            console.log('Updating info panel...');
            let info = "<div style='background:#f8f9fa;padding:15px;border-radius:8px;'>";
            info += "<h4 style='margin:0 0 10px 0;color:#2E86AB;'>" + pheno_info.display_name + "</h4>";
            info += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:15px;'>";
            info += "<div><strong>Type:</strong> " + pheno_info.type + "</div>";
            info += "<div><strong>Patients:</strong> " + pheno_info.n_patients.toLocaleString() + "</div>";
            info += "<div><strong>Events:</strong> " + pheno_info.n_events.toLocaleString() + "</div>";
            info += "<div><strong>Data Points:</strong> " + y_data.length + "</div>";
            
            if (viz_mode === "histogram" && viz_data.summary && viz_data.summary.count > 0) {
                console.log('Adding summary statistics to info panel');
                info += "<div><strong>Mean:</strong> " + viz_data.summary.mean.toFixed(2) + "</div>";
                info += "<div><strong>Std:</strong> " + viz_data.summary.std.toFixed(2) + "</div>";
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
                colors=self.colors
            ),
            code=callback_code
        )
        
        # Register callbacks (crucial step!)
        phenotype_select.js_on_change('value', callback)
        viz_mode_select.js_on_change('value', callback)
        
        # Create dashboard layout
        header = self._create_header()
        instructions = self._create_instructions()
        controls = row(phenotype_select, viz_mode_select, width=self.width)
        
        self.dashboard_layout = column(
            header, instructions,
            Div(text="<h3>Controls</h3>", width=self.width),
            controls, info_div, plot, width=self.width
        )
        
    def _get_initial_visualization(self, phenotype_name: str) -> Dict[str, Any]:
        """Get initial visualization data for the default phenotype."""
        viz_data = self.phenotype_data[phenotype_name]['viz_data']
        
        # Try to get histogram data first
        if len(viz_data['value_hist']['values']) > 0:
            x_data = viz_data['value_hist']['values']
            y_data = viz_data['value_hist']['counts']
            x_label = "Value"
        elif len(viz_data['frequency']['values']) > 0:
            x_data = viz_data['frequency']['values']
            y_data = viz_data['frequency']['counts']
            x_label = "Events per Patient"
        else:
            x_data = [0]
            y_data = [0]
            x_label = "No Data"
            
        # Calculate bar width
        width = 1
        if len(x_data) > 1:
            width = (max(x_data) - min(x_data)) / len(x_data) * 0.8
            
        return {'x': x_data, 'y': y_data, 'width': width, 'x_label': x_label}
        
    def _create_header(self) -> Div:
        """Create dashboard header."""
        n_phenotypes = len(self.cohort.phenotypes)
        
        try:
            if hasattr(self.cohort, 'index_table') and self.cohort.index_table is not None:
                if hasattr(self.cohort.index_table, 'count'):
                    n_patients = self.cohort.index_table.count().execute()
                else:
                    n_patients = len(self.cohort.index_table)
            else:
                n_patients = "Unknown"
        except:
            n_patients = "Unknown"
        
        patient_display = f"{n_patients:,}" if isinstance(n_patients, int) else str(n_patients)
            
        header_html = f"""
        <div style='background:linear-gradient(135deg,#2E86AB 0%,#A23B72 100%);
                    color:white;padding:20px;border-radius:10px;margin-bottom:20px;'>
            <h1 style='margin:0 0 10px 0;font-size:24px;'>{self.title}</h1>
            <h2 style='margin:0 0 15px 0;font-size:18px;opacity:0.9;'>Cohort: {self.cohort.name}</h2>
            <div style='display:flex;gap:30px;align-items:center;flex-wrap:wrap;'>
                <div style='background:rgba(255,255,255,0.2);padding:8px 15px;border-radius:20px;'>
                    <strong>📊 Patients:</strong> {patient_display}
                </div>
                <div style='background:rgba(255,255,255,0.2);padding:8px 15px;border-radius:20px;'>
                    <strong>🔬 phenotypes:</strong> {n_phenotypes}
                </div>
            </div>
        </div>"""
        
        return Div(text=header_html, width=self.width)
        
    def _create_instructions(self) -> Div:
        """Create instructions panel."""
        instructions_html = """
        <div style='background:#e8f4f8;padding:15px;border-radius:8px;margin-bottom:20px;
                    border-left:5px solid #2E86AB;'>
            <h3 style='margin:0 0 10px 0;color:#0d47a1;'>🔍 Interactive Cohort Explorer</h3>
            <p><strong>Explore cohort phenotypes:</strong> Select different phenotypes and 
            visualization modes to analyze VALUE column distributions, timelines, and frequencies.</p>
        </div>"""
        
        return Div(text=instructions_html, width=self.width)
        
    def _create_info_text(self, phenotype_name: str, viz_mode: str) -> str:
        """Create info panel text for a phenotype."""
        pheno_info = self.phenotype_data[phenotype_name]
        
        return f"""
        <div style='background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:15px;'>
            <h4 style='margin:0 0 10px 0;color:#2E86AB;'>{pheno_info['display_name']}</h4>
            <div style='display:grid;grid-template-columns:1fr 1fr;gap:15px;'>
                <div><strong>Type:</strong> {pheno_info['type']}</div>
                <div><strong>Patients:</strong> {pheno_info['n_patients']:,}</div>
                <div><strong>Events:</strong> {pheno_info['n_events']:,}</div>
                <div><strong>Has Values:</strong> {'Yes' if pheno_info['has_values'] else 'No'}</div>
            </div>
        </div>"""
        
    def _create_empty_dashboard(self):
        """Create dashboard for when no phenotypes are available."""
        empty_html = """
        <div style='background:#fff3cd;border:1px solid #ffeaa7;color:#856404;
                    padding:20px;border-radius:8px;text-align:center;'>
            <h2>⚠️ No phenotypes Available</h2>
            <p>Add phenotypes to your cohort to use the Interactive Explorer:</p>
            <code>cohort = Cohort(name="my_cohort", phenotypes=[...], ...)</code>
        </div>"""
        
        self.dashboard_layout = column(
            Div(text=f"<h1>{self.title}</h1>", width=self.width),
            Div(text=empty_html, width=self.width)
        )
        
    def show(self, notebook: bool = True):
        """Display the interactive dashboard."""
        if notebook:
            output_notebook()
            
        if hasattr(self, 'dashboard_layout') and self.dashboard_layout is not None:
            show(self.dashboard_layout)
        else:
            logger.error("Dashboard not built yet. Call execute() first.")
            
    def export_to_html(self, filename: str = "cohort_explorer.html") -> str:
        """Export the dashboard to an HTML file."""
        if not hasattr(self, 'dashboard_layout') or self.dashboard_layout is None:
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
            summary_data.append({
                'Phenotype': info['display_name'],
                'Type': info['type'],
                'Patients': info['n_patients'],
                'Events': info['n_events'],
                'Has Values': info['has_values'],
                'Has Dates': info['has_dates']
            })
            
        return pd.DataFrame(summary_data)