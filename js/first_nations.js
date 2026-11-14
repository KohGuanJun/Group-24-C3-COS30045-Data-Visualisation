let rawFnData = [];
const fnSelection = {
    category: null, // "Remoteness" | "Age" | "Road User"
    value: null     // clicked sub-category value
};

const fnTrendCategory = "Age";

function initFirstNationsCharts() {
    if (!rawFnData.length) return;

    const yearEl = document.getElementById("filter-year");
    const yearVal = yearEl ? yearEl.value : "All";

    const filtered = yearVal === "All"
        ? rawFnData
        : rawFnData.filter(d => String(d["Calendar year"]) === String(yearVal));

    updateFnKeyFinding(filtered, yearVal);
    renderFnTrendChart(yearVal);
    renderFnRemotenessChart(filtered);
    renderFnAgeChart(filtered);
    renderFnRoadUserChart(filtered);
}

function updateFnKeyFinding(data, yearVal) {
    const findingBar = document.getElementById("fn-key-finding");
    if (!findingBar) return;

    const periodText = yearVal === "All" ? "2011–2021" : yearVal;
    
    if (fnSelection.value) {
        findingBar.innerHTML = `<strong>First Nations Filter (${fnSelection.category}):</strong> Showing data filtered for <strong>${fnSelection.value}</strong> (${periodText}).` +
            ` &nbsp; <button type="button" class="mini-btn" id="btn-clear-fn-sel">Clear selection</button>`;
        const clearBtn = document.getElementById("btn-clear-fn-sel");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                fnSelection.category = null;
                fnSelection.value = null;
                initFirstNationsCharts();
            });
        }
        return;
    }

    const fnRows = data.filter(d =>
        d.Category === fnTrendCategory && d["First Nations status"] === "First Nations people"
    );
    const fnTotal = d3.sum(fnRows, d => d["Sum(Hospitalisations)"] || 0);

    findingBar.innerHTML = `<strong>First Nations Insights (${periodText}):</strong> Recorded <strong>${d3.format(",")(fnTotal)}</strong> First Nations hospitalisations. ` +
        `<em>Tip: Click a bar, dot or slice to highlight and focus on a specific group.</em>`;
}

// 1. Annual Trend Line Chart
function renderFnTrendChart(yearVal) {
    const container = d3.select("#fn-chart-trend");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const margin = { top: 24, right: 30, bottom: 28, left: 76 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Use rawFnData so the trend line preserves full historical context across 2011–2021
    let activeData = rawFnData.filter(d => d.Category === fnTrendCategory);
    if (fnSelection.value) {
        activeData = rawFnData.filter(d => d.Category === fnSelection.category && d.Sub_Category === fnSelection.value);
    }

    const years = Array.from(new Set(activeData.map(d => d["Calendar year"]))).sort(d3.ascending);
    const statuses = ["First Nations people", "Non-Indigenous"];

    const series = statuses.map(st => {
        const rows = activeData.filter(d => d["First Nations status"] === st);
        const yrMap = d3.rollup(rows, v => d3.sum(v, d => d["Sum(Hospitalisations)"]), d => d["Calendar year"]);
        return {
            status: st,
            values: years.map(yr => ({ year: yr, val: yrMap.get(yr) || 0 }))
        };
    });

    const maxVal = d3.max(series, s => d3.max(s.values, d => d.val)) || 1;

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-trend-title fn-trend-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-trend-title").text("First Nations vs Non-Indigenous Annual Trend");
    svg.append("desc").attr("id", "fn-trend-desc").text("Line chart comparing annual hospitalisations from 2011 to 2021. Select a year label or a point to filter the other charts. Select the same year again to show all years.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint().domain(years).range([0, innerWidth]).padding(0.25);
    const y = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([innerHeight, 0]);
    const tooltip = d3.select("#tooltip");

    function addYearSelection(marks, getYear, getLabel, getId) {
        marks
            .attr("id", getId)
            .attr("role", "button")
            .attr("tabindex", 0)
            .attr("aria-label", getLabel)
            .attr("aria-pressed", d => String(getYear(d)) === yearVal)
            .style("cursor", "pointer")
            .on("click.select-year", function (event, d) {
                const yearSelect = document.getElementById("filter-year");
                const year = String(getYear(d));
                const restoreFocus = document.activeElement === this;
                const id = this.id;
                tooltip.classed("hidden", true);
                yearSelect.value = yearSelect.value === year ? "All" : year;
                yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
                if (restoreFocus) document.getElementById(id)?.focus();
            })
            .on("keydown.select-year", function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (!event.repeat) this.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                }
            });
    }

    // Gridlines
    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3"));

    // X-Axis
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickSizeOuter(0))
        .call(g => g.select(".domain").attr("stroke", "#cbd5e1"))
        .selectAll("text")
        .style("font-size", "14px")
        .style("fill", "#374151")
        .style("font-weight", d => String(d) === yearVal ? "700" : "400")
        .call(addYearSelection, year => year, year => `Filter by ${year}`, year => `fn-trend-year-${year}`);

    // Y-Axis
    g.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").remove())
        .selectAll("text")
        .style("font-size", "14px")
        .style("fill", "#374151");

    const colorScale = {
        "First Nations people": "#D55E00",
        "Non-Indigenous": "#0072B2"
    };

    const line = d3.line().x(d => x(d.year)).y(d => y(d.val));

    series.forEach((s, seriesIndex) => {
        g.append("path")
            .datum(s.values)
            .attr("fill", "none")
            .attr("stroke", colorScale[s.status])
            .attr("stroke-width", 2.6)
            .attr("opacity", 0.85)
            .attr("d", line);

        g.selectAll(`.dot-${s.status.replace(/\s+/g, '')}`)
            .data(s.values)
            .join("circle")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.val))
            .attr("r", d => String(d.year) === String(yearVal) ? 7 : 4.5)
            .attr("fill", colorScale[s.status])
            .attr("stroke", d => String(d.year) === String(yearVal) ? "#111827" : "#ffffff")
            .attr("stroke-width", d => String(d.year) === String(yearVal) ? 2.5 : 2)
            .call(
                addYearSelection,
                d => d.year,
                d => `${s.status} in ${d.year}, ${d3.format(",")(d.val)} hospitalisations. Filter by year.`,
                d => `fn-trend-point-${seriesIndex}-${d.year}`
            )
            .on("mouseenter", (event, d) => {
                tooltip.classed("hidden", false)
                    .html(`<strong>${s.status} (${d.year})</strong><br/>Hospitalisations: <strong>${d3.format(",")(d.val)}</strong>`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
            })
            .on("mouseleave", () => tooltip.classed("hidden", true));
    });

    const legend = svg.append("g").attr("transform", `translate(${margin.left + 10}, ${margin.top + 2})`);
    statuses.forEach((st, i) => {
        const lg = legend.append("g").attr("transform", `translate(${i * 169}, 0)`);
        lg.append("rect").attr("width", 10).attr("height", 10).attr("fill", colorScale[st]).attr("rx", 2);
        lg.append("text").attr("x", 14).attr("y", 9).style("font-size", "14px").style("fill", "#374151").text(st);
    });
}

// 2. Remoteness Donut Chart
function renderFnRemotenessChart(data) {
    const container = d3.select("#fn-chart-remoteness");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;

    const remData = data.filter(d => d.Category === "Remoteness" && d["First Nations status"] === "First Nations people");
    const summaryMap = d3.rollup(remData, v => d3.sum(v, d => d["Sum(Hospitalisations)"] || 0), d => d.Sub_Category);
    const summary = Array.from(summaryMap, ([key, val]) => ({ key, val }))
        .sort((a, b) => d3.descending(a.val, b.val));

    const total = d3.sum(summary, d => d.val) || 1;

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-rem-title fn-rem-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-rem-title").text("First Nations Share by Remoteness Area");
    svg.append("desc").attr("id", "fn-rem-desc").text("Donut chart showing First Nations hospitalisations across remoteness areas.");

    const radius = Math.min(width * 0.42, height) / 2 - 12;
    const centerX = width * 0.28;
    const centerY = height / 2;

    const g = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);

    const color = d3.scaleOrdinal()
        .domain(summary.map(d => d.key))
        .range(["#D55E00", "#0072B2", "#009E73"]);

    const pie = d3.pie().value(d => d.val).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.54).outerRadius(radius);
    const tooltip = d3.select("#tooltip");

    const isRemSelected = fnSelection.category === "Remoteness";

    g.selectAll("path")
        .data(pie(summary))
        .join("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.key))
        .attr("stroke", d => (isRemSelected && fnSelection.value === d.data.key) ? "#111827" : "#ffffff")
        .attr("stroke-width", d => (isRemSelected && fnSelection.value === d.data.key) ? 3 : 2.2)
        .attr("opacity", d => (!isRemSelected || fnSelection.value === d.data.key) ? 1 : 0.25)
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            const pct = ((d.data.val / total) * 100).toFixed(1);
            tooltip.classed("hidden", false)
                .html(`<strong>${d.data.key} (First Nations)</strong><br/>Injuries: <strong>${d3.format(",")(d.data.val)}</strong> (${pct}%)`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("click", (event, d) => {
            if (fnSelection.category === "Remoteness" && fnSelection.value === d.data.key) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Remoteness";
                fnSelection.value = d.data.key;
            }
            initFirstNationsCharts();
        });

    g.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em").style("font-size", "14px").style("fill", "#374151").text("Total");
    g.append("text").attr("text-anchor", "middle").attr("dy", "1.1em").style("font-size", "18px").style("font-weight", "700").style("fill", "#111827").text(d3.format(",")(total));

    const rowSpacing = Math.min(22, (height - 20) / Math.max(summary.length, 1));
    const startY = (height - (summary.length - 1) * rowSpacing) / 2;
    const legendWidth = 222;
    const legendX = Math.min(width * 0.54, width - legendWidth - 8);
    const legend = svg.append("g").attr("transform", `translate(${legendX}, ${startY})`);

    const rows = legend.selectAll(".legend-item")
        .data(summary)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * rowSpacing})`)
        .attr("opacity", d => (!isRemSelected || fnSelection.value === d.key) ? 1 : 0.35)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            if (fnSelection.category === "Remoteness" && fnSelection.value === d.key) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Remoteness";
                fnSelection.value = d.key;
            }
            initFirstNationsCharts();
        });

    rows.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("y", -10).attr("fill", d => color(d.key));
    rows.append("text").attr("x", 18).attr("y", 0).style("font-size", "14px").style("font-weight", "700").style("fill", "#1f2937").text(d => d.key);
    rows.append("text").attr("x", legendWidth).attr("y", 0).attr("text-anchor", "end").style("font-size", "14px").style("font-weight", "600").style("fill", "#374151").text(d => `${d3.format(",")(d.val)} (${((d.val / total) * 100).toFixed(1)}%)`);
}

// 3. Age Group Column Chart (with multi-year d3.sum aggregation & click-to-highlight)
function renderFnAgeChart(data) {
    const container = d3.select("#fn-chart-age");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const margin = { top: 33, right: 30, bottom: 31, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const ageGroups = ["0-7", "8-16", "17-25", "26-39", "40-64", "65+"];
    const statuses = ["First Nations people", "Non-Indigenous"];
    const counts = d3.rollup(
        data.filter(d => d.Category === "Age"),
        rows => d3.sum(rows, d => d["Sum(Hospitalisations)"] || 0),
        d => d["First Nations status"],
        d => d.Sub_Category
    );
    const points = statuses.flatMap(status => {
        const byAge = counts.get(status);
        const total = d3.sum(ageGroups, age => byAge?.get(age) || 0);
        if (!total) return [];
        return ageGroups.map(age => {
            const count = byAge?.get(age) || 0;
            return { status, age, count, share: count / total };
        });
    });
    const formatShare = d3.format(".1%");
    const formatCount = d3.format(",");

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-age-title fn-age-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-age-title").text("Age Distribution of Hospitalisations");
    svg.append("desc").attr("id", "fn-age-desc").text(
        "Dot plot showing the share of known-age hospitalisations within each population group. " +
        "Select a dot to highlight its age group."
    );

    const g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    const x = d3.scaleLinear()
        .domain([0, (d3.max(points, d => d.share) || 0.1) * 1.10])
        .nice(4)
        .range([0, innerWidth]);
    const y = d3.scaleBand().domain(ageGroups).range([0, innerHeight]).padding(0.15);
    const centerY = (d) => y(d.age) + y.bandwidth() / 2;
    const colorScale = { "First Nations people": "#D55E00", "Non-Indigenous": "#0072B2" };

    g.append("g")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format(".0%")).tickSize(-innerHeight))
        .call(axis => axis.select(".domain").remove())
        .call(axis => axis.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3"))
        .selectAll("text")
        .style("font-size", "14px")
        .style("fill", "#374151");

    g.append("g")
        .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
        .call(axis => axis.select(".domain").remove())
        .selectAll("text")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("fill", "#1f2937");

    const legend = svg.append("g").attr("transform", "translate(" + margin.left + ",15)");
    const legendItems = legend.selectAll("g").data(statuses).join("g")
        .attr("transform", (_, i) => "translate(" + (i * 169) + ",0)");
    legendItems.append("circle").attr("r", 4.5).attr("fill", status => colorScale[status]);
    legendItems.append("text")
        .attr("x", 10)
        .attr("dy", "0.35em")
        .style("font-size", "14px")
        .style("fill", "#374151")
        .text(status => status);

    const tooltip = d3.select("#tooltip");
    const isAgeSelected = fnSelection.category === "Age";

    g.selectAll(".fn-age-dot")
        .data(points)
        .join("circle")
        .attr("class", "fn-age-dot")
        .attr("cx", d => x(d.share))
        .attr("cy", d => centerY(d) + (d.status === statuses[0] ? -5 : 5))
        .attr("r", 4.5)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", d => d.age + ", " + d.status + ": " + formatShare(d.share) + ", " + formatCount(d.count) + " hospitalisations. Select age group.")
        .attr("fill", d => colorScale[d.status])
        .attr("stroke", d => (isAgeSelected && fnSelection.value === d.age) ? "#111827" : "none")
        .attr("stroke-width", 2)
        .attr("opacity", d => (!isAgeSelected || fnSelection.value === d.age) ? 1 : 0.25)
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            tooltip.classed("hidden", false)
                .html(`<strong>Age ${d.age} — ${d.status}</strong><br/>Share within population group: <strong>${formatShare(d.share)}</strong><br/>Hospitalisations: <strong>${formatCount(d.count)}</strong>`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("keydown", function(event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            }
        })
        .on("click", (event, d) => {
            if (fnSelection.category === "Age" && fnSelection.value === d.age) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Age";
                fnSelection.value = d.age;
            }
            initFirstNationsCharts();
        });
}

// 4. Road User Horizontal Bar Chart (with multi-year d3.sum aggregation, wide margin & click-to-highlight)
function renderFnRoadUserChart(data) {
    const container = d3.select("#fn-chart-roaduser");
    if (container.empty()) return;
    container.selectAll("*").remove();

    const node = container.node();
    const width = node.clientWidth || 540;
    const height = node.clientHeight || 205;
    const margin = { top: 15, right: 30, bottom: 26, left: 254 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const roadUserLabels = {
        "Car driver, passenger or unknown position": "Car occupant / unknown position",
        "Heavy transport driver, passenger or unknown position": "Heavy transport / unknown position",
    };
    const ruData = data.filter(d => d.Category === "Road User");
    const roadUsers = Array.from(new Set(ruData.map(d => d.Sub_Category)));

    // Aggregates across all years in active view using d3.sum
    const summary = roadUsers.map(ru => {
        const totalVal = d3.sum(
            ruData.filter(d => d.Sub_Category === ru && d["First Nations status"] === "First Nations people"),
            d => d["Sum(Hospitalisations)"] || 0
        );
        return {
            roadUser: ru,
            val: totalVal
        };
    }).sort((a, b) => d3.descending(a.val, b.val));

    const svg = container.append("svg")
        .attr("role", "img")
        .attr("aria-labelledby", "fn-ru-title fn-ru-desc")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", "100%");

    svg.append("title").attr("id", "fn-ru-title").text("First Nations Injuries by Road User Type");
    svg.append("desc").attr("id", "fn-ru-desc").text("Horizontal bar chart showing road crash injuries by road user type.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand().domain(summary.map(d => d.roadUser)).range([0, innerHeight]).padding(0.25);
    const x = d3.scaleLinear().domain([0, (d3.max(summary, d => d.val) || 1) * 1.15]).nice().range([0, innerWidth]);

    g.append("g")
        .call(d3.axisLeft(y).tickSize(0).tickFormat(label => roadUserLabels[label] ?? label))
        .call(g => g.select(".domain").remove())
        .selectAll("text")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("fill", "#1f2937");

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-innerHeight))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll("line").attr("stroke", "#e5e7eb").attr("stroke-dasharray", "3,3"))
        .selectAll("text")
        .style("font-size", "14px")
        .style("fill", "#374151");

    const tooltip = d3.select("#tooltip");
    const isRuSelected = fnSelection.category === "Road User";

    g.selectAll(".fn-ru-bar")
        .data(summary)
        .join("rect")
        .attr("class", "fn-ru-bar")
        .attr("y", d => y(d.roadUser))
        .attr("x", 0)
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.val))
        .attr("rx", 3)
        .attr("fill", "#009E73")
        .attr("stroke", d => (isRuSelected && fnSelection.value === d.roadUser) ? "#111827" : "none")
        .attr("stroke-width", 2)
        .attr("opacity", d => (!isRuSelected || fnSelection.value === d.roadUser) ? 1 : 0.25)
        .style("cursor", "pointer")
        .on("mouseenter", (event, d) => {
            tooltip.classed("hidden", false)
                .html(`<strong>${d.roadUser}</strong><br/>First Nations Hospitalisations: <strong>${d3.format(",")(d.val)}</strong>`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY - 28}px`);
        })
        .on("mouseleave", () => tooltip.classed("hidden", true))
        .on("click", (event, d) => {
            if (fnSelection.category === "Road User" && fnSelection.value === d.roadUser) {
                fnSelection.category = null;
                fnSelection.value = null;
            } else {
                fnSelection.category = "Road User";
                fnSelection.value = d.roadUser;
            }
            initFirstNationsCharts();
        });
}

document.addEventListener("DOMContentLoaded", () => {
    d3.csv("First_Nations_Combined.csv", d3.autoType)
        .then(data => {
            rawFnData = data;
            initFirstNationsCharts();
        })
        .catch(() => {
            d3.csv("first_nations_combined.csv", d3.autoType)
                .then(data => {
                    rawFnData = data;
                    initFirstNationsCharts();
                })
                .catch(err => {
                    d3.csv("data/First_Nations_Combined.csv", d3.autoType)
                        .then(data => {
                            rawFnData = data;
                            initFirstNationsCharts();
                        })
                        .catch(err2 => {
                            d3.csv("data/first_nations_combined.csv", d3.autoType)
                                .then(data => {
                                    rawFnData = data;
                                    initFirstNationsCharts();
                                })
                                .catch(err3 => console.warn("Could not load First Nations dataset", err3));
                        });
                });
        });

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => setTimeout(initFirstNationsCharts, 50));
    });

    const yearSelect = document.getElementById("filter-year");
    const resetBtn = document.getElementById("btn-reset-filters");

    if (yearSelect) yearSelect.addEventListener("change", initFirstNationsCharts);
    if (resetBtn) resetBtn.addEventListener("click", () => {
        fnSelection.category = null;
        fnSelection.value = null;
        setTimeout(initFirstNationsCharts, 50);
    });

    window.addEventListener("resize", initFirstNationsCharts);
});
