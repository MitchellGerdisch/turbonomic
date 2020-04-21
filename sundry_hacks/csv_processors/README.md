# CSV Processor Scripts
A gaggle of powershell scripts that can be used to process a CSV and produce regular expressions that can then be used to create Turbonomic groups.

For example, the make-memmetrics-group_from_utilization-widget-csv.ps1 (that's a mouthful) script takes the CSV from a cloud top VMs widget CSV download and produces two regular expressions. These can then be used for filters when defining dynamic groups that represent instances with memory metrics enabled and instances without.