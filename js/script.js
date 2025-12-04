// Global variables
let data = [];
let correlationMatrix = [];
let variables = [];
let sortedOrder = false;

// Visualization dimensions
const margin = { top: 120, right: 50, bottom: 100, left: 160 };
const cellSize = 90;

// Color schemes
const colorSchemes = {
    redblue: {
        negative: '#d62728',
        neutral: '#ffffff',
        positive: '#1f77b4'
    },
    viridis: {
        scale: d3.interpolateViridis
    },
    coolwarm: {
        negative: '#3b4cc0',
        neutral: '#f7f7f7',
        positive: '#b40426'
    }
};

let currentColorScheme = 'redblue';

// Variable mapping - these are the health indicators we want to analyze
const variableMapping = {
    '_BMI5': 'BMI',
    'GENHLTH': 'General Health',
    'SMOKE100': 'Smoking Status',
    'SMOKDAY2': 'Smoke Daily',
    'EXERANY2': 'Exercise',
    'DIABETE4': 'Diabetes',
    'CVDINFR4': 'Heart Attack',
    'CVDCRHD4': 'Heart Disease',
    'CVDSTRK3': 'Stroke',
    'PHYSHLTH': 'High BP'
};

// Load and process data
d3.csv('data/BRFSS_2024_cleaned.csv').then(function(rawData) {
    console.log('Data loaded:', rawData.length, 'rows');
    console.log('Sample row:', rawData[0]);
    
    // Process data - filter and convert to numeric
    data = rawData.map(d => {
        const processed = {};
        Object.keys(variableMapping).forEach(key => {
            const value = +d[key];
            // Filter out missing/invalid values (typically 7, 9, 77, 99, 777, 999, etc.)
            if (!isNaN(value) && value > 0 && value < 10) {
                processed[key] = value;
            } else {
                processed[key] = null;
            }
        });
        return processed;
    }).filter(d => {
        // Keep only rows with at least 5 valid values
        const validCount = Object.values(d).filter(v => v !== null).length;
        return validCount >= 5;
    });
    
    console.log('Processed data:', data.length, 'valid rows');
    
    // Calculate correlation matrix
    variables = Object.keys(variableMapping);
    correlationMatrix = calculateCorrelationMatrix(data, variables);
    
    console.log('Correlation matrix calculated');
    console.log('Sample correlations:', correlationMatrix.slice(0, 3));
    
    // Create visualization
    createHeatmap();
    
    // Setup event listeners
    setupEventListeners();
    
}).catch(error => {
    console.error('Error loading data:', error);
    d3.select('#visualization').html('<p style="color: red; text-align: center;">Error loading data. Please check console.</p>');
});

// Calculate Pearson correlation coefficient
function pearsonCorrelation(x, y) {
    // Filter out null pairs
    const pairs = x.map((xi, i) => [xi, y[i]])
        .filter(([xi, yi]) => xi !== null && yi !== null);
    
    if (pairs.length < 10) return null; // Need minimum sample size
    
    const xVals = pairs.map(p => p[0]);
    const yVals = pairs.map(p => p[1]);
    
    const n = pairs.length;
    const sumX = d3.sum(xVals);
    const sumY = d3.sum(yVals);
    const sumXY = d3.sum(xVals.map((x, i) => x * yVals[i]));
    const sumX2 = d3.sum(xVals.map(x => x * x));
    const sumY2 = d3.sum(yVals.map(y => y * y));
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return null;
    
    return numerator / denominator;
}

// Calculate full correlation matrix
function calculateCorrelationMatrix(data, variables) {
    const matrix = [];
    
    for (let i = 0; i < variables.length; i++) {
        for (let j = 0; j < variables.length; j++) {
            const varX = variables[i];
            const varY = variables[j];
            
            const xValues = data.map(d => d[varX]);
            const yValues = data.map(d => d[varY]);
            
            const correlation = i === j ? 1 : pearsonCorrelation(xValues, yValues);
            
            matrix.push({
                x: i,
                y: j,
                varX: varX,
                varY: varY,
                labelX: variableMapping[varX],
                labelY: variableMapping[varY],
                value: correlation
            });
        }
    }
    
    return matrix;
}

// Create the heatmap visualization
function createHeatmap() {
    // Clear existing SVG
    d3.select('#heatmap').selectAll('*').remove();
    
    const width = cellSize * variables.length + margin.left + margin.right;
    const height = cellSize * variables.length + margin.top + margin.bottom;
    
    const svg = d3.select('#heatmap')
        .attr('width', width)
        .attr('height', height);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Create scales
    const x = d3.scaleBand()
        .domain(variables.map((d, i) => i))
        .range([0, cellSize * variables.length]);
    
    const y = d3.scaleBand()
        .domain(variables.map((d, i) => i))
        .range([0, cellSize * variables.length]);
    
    // Color scale
    const colorScale = getColorScale();
    
    // Create cells
    const cells = g.selectAll('.cell')
        .data(correlationMatrix)
        .enter()
        .append('rect')
        .attr('class', 'cell')
        .attr('x', d => x(d.x))
        .attr('y', d => y(d.y))
        .attr('width', cellSize - 2)
        .attr('height', cellSize - 2)
        .attr('fill', d => d.value !== null ? colorScale(d.value) : '#cccccc')
        .attr('opacity', 0)
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut);
    
    // Animate cells
    cells.transition()
        .duration(800)
        .delay((d, i) => i * 2)
        .attr('opacity', 1);
    
    // Add text values in cells
    g.selectAll('.cell-text')
        .data(correlationMatrix)
        .enter()
        .append('text')
        .attr('class', 'cell-text')
        .attr('x', d => x(d.x) + cellSize / 2)
        .attr('y', d => y(d.y) + cellSize / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', d => {
            if (d.value === null) return '#666';
            return Math.abs(d.value) > 0.5 ? 'white' : 'black';
        })
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('opacity', 0)
        .text(d => d.value !== null ? d.value.toFixed(2) : 'N/A')
        .transition()
        .duration(800)
        .delay((d, i) => i * 2 + 400)
        .attr('opacity', 0.9);
    
    // Add X axis labels
    g.selectAll('.x-label')
        .data(variables)
        .enter()
        .append('text')
        .attr('class', 'axis-label x-label')
        .attr('x', (d, i) => x(i) + cellSize *1.3 )
        .attr('y', -80) // Moved much higher to prevent overlap
        .attr('text-anchor', 'end')
        .attr('transform', (d, i) => `rotate(-45, ${x(i) + cellSize *1.3}, -30)`)
        .text(d => variableMapping[d])
        .style('opacity', 0)
        .transition()
        .duration(600)
        .delay((d, i) => i * 50)
        .style('opacity', 1);
    
    // Add Y axis labels
    g.selectAll('.y-label')
        .data(variables)
        .enter()
        .append('text')
        .attr('class', 'axis-label y-label')
        .attr('x', -40)
        .attr('y', (d, i) => y(i) + cellSize / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .text(d => variableMapping[d])
        .style('opacity', 0)
        .transition()
        .duration(600)
        .delay((d, i) => i * 50)
        .style('opacity', 1);
    
    // Add color legend
    addColorLegend(svg, colorScale, width, height);
}

// Get color scale based on current scheme
function getColorScale() {
    const scheme = colorSchemes[currentColorScheme];
    
    if (scheme.scale) {
        return d3.scaleSequential()
            .domain([-1, 1])
            .interpolator(scheme.scale);
    } else {
        return d3.scaleLinear()
            .domain([-1, 0, 1])
            .range([scheme.negative, scheme.neutral, scheme.positive]);
    }
}

// Add color legend
function addColorLegend(svg, colorScale, width, height) {
    const legendWidth = 300;
    const legendHeight = 20;
    const legendX = (width - legendWidth) / 2; // Center the legend
    const legendY = height - 60; // Position below the heatmap with more space
    
    const legend = svg.append('g')
        .attr('transform', `translate(${legendX},${legendY})`);
    
    // Create gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'legend-gradient');
    
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
        const value = -1 + (2 * i / numStops);
        gradient.append('stop')
            .attr('offset', `${(i / numStops) * 100}%`)
            .attr('stop-color', colorScale(value));
    }
    
    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)')
        .style('stroke', '#333')
        .style('stroke-width', 1);
    
    legend.append('text')
        .attr('x', 0)
        .attr('y', -8)
        .attr('text-anchor', 'start')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text('-1 (Negative)');
    
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -8)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text('0 (No Correlation)');
    
    legend.append('text')
        .attr('x', legendWidth)
        .attr('y', -8)
        .attr('text-anchor', 'end')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text('+1 (Positive)');
    
    // Add title above legend
    legend.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', -28)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#333')
        .text('Correlation Strength');
}

// Handle mouse over
function handleMouseOver(event, d) {
    const tooltip = d3.select('.tooltip');
    
    if (d.value !== null) {
        let interpretation = '';
        const absValue = Math.abs(d.value);
        
        if (absValue > 0.7) interpretation = 'Strong';
        else if (absValue > 0.4) interpretation = 'Moderate';
        else if (absValue > 0.2) interpretation = 'Weak';
        else interpretation = 'Very Weak';
        
        const direction = d.value > 0 ? 'Positive' : 'Negative';
        
        tooltip.html(`
            <strong>${d.labelX} vs ${d.labelY}</strong>
            Correlation: ${d.value.toFixed(3)}<br>
            Strength: ${interpretation} ${direction}
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 300) + 'px')
        .classed('show', true);
    } else {
        tooltip.html(`
            <strong>${d.labelX} vs ${d.labelY}</strong>
            Insufficient data
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 300) + 'px')
        .classed('show', true);
    }
    
    // Highlight row and column
    d3.selectAll('.cell')
        .transition()
        .duration(200)
        .attr('opacity', cell => 
            (cell.x === d.x || cell.y === d.y) ? 1 : 0.3
        );
}

// Handle mouse out
function handleMouseOut() {
    d3.select('.tooltip')
        .classed('show', false);
    
    d3.selectAll('.cell')
        .transition()
        .duration(200)
        .attr('opacity', 1);
}

// Setup event listeners
function setupEventListeners() {
    // Color scheme selector
    d3.select('#colorScheme').on('change', function() {
        currentColorScheme = this.value;
        createHeatmap();
    });
    
    // Sort button
    d3.select('#sortButton').on('click', function() {
        sortedOrder = !sortedOrder;
        
        if (sortedOrder) {
            // Calculate average absolute correlation for each variable
            const avgCorrelations = variables.map((varName, idx) => {
                const correlations = correlationMatrix
                    .filter(d => (d.x === idx || d.y === idx) && d.x !== d.y && d.value !== null)
                    .map(d => Math.abs(d.value));
                
                const avg = d3.mean(correlations) || 0;
                return { varName, idx, avg };
            });
            
            // Sort by average correlation (descending)
            avgCorrelations.sort((a, b) => b.avg - a.avg);
            
            // Create new order mapping
            const newOrder = avgCorrelations.map(d => d.idx);
            
            // Reorder variables
            const oldVariables = [...variables];
            variables = newOrder.map(i => oldVariables[i]);
            
            // Recalculate matrix with new order
            correlationMatrix = calculateCorrelationMatrix(data, variables);
            
            this.textContent = 'Reset Order';
        } else {
            // Reset to original order
            variables = Object.keys(variableMapping);
            correlationMatrix = calculateCorrelationMatrix(data, variables);
            this.textContent = 'Sort by Correlation Strength';
        }
        
        createHeatmap();
    });
}
