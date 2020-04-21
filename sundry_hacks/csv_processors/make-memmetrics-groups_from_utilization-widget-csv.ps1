# This script takes the CSV from the Top Virtual Machines widget and creates two big regexps that can be used to create two groups: one with instances with memory metrics enabled and 
# one with instances with out memory metrics enabled.
# See https://greencircle.vmturbo.com/docs/DOC-6202 for how to get this CSV.
#
# NOTES/CAVEATS
#   1) It only looks at active instances and assumes 0 memory used indicates no memory metrics.
#	2) Lightly tested. Review the resultant groups and make sure the numbers look about right. 
#
# INPUTS: 
#	CSV_FILE: CSV download from Top VMs widget.
#
# OUTPUT: 
# a regular expression of server names to be used as a Name filter for a Turbonomic Virtual Machine Dynamic group that contains memory metrics enabled instances.
# a regular expression of server names to be used to create a group of instances without memory metrics enabled.

param(
[Parameter(Mandatory=$true)][string]$CSV_FILE
)

$JSON_STUFF = Import-Csv $CSV_FILE |  ConvertTo-Json  | ConvertFrom-Json

$MEM_METRICS_ENABLED_FILTER_REGEXP = ""
$MEM_METRICS_NOTENABLED_FILTER_REGEXP = ""
$MEM_METRICS_ENABLED_NUMBER_FOUND_SERVERS = 0
$MEM_METRICS_NOTENABLED_NUMBER_FOUND_SERVERS = 0
foreach ($ITEM in $JSON_STUFF) {
	$NAME = $ITEM."Virtual Machines"
	$STATE = $ITEM."State"
	$MEM_USED_STRING = $ITEM."Virtual Memory Used (KB)"
	$MEM_USED = [int]$MEM_USED_STRING

	if ($STATE -eq "Active") {
		$NAME_REGEXP = "^$NAME$"
		
		if ($MEM_USED -gt 0) {
			if ($MEM_METRICS_ENABLED_FILTER_REGEXP) {
				if (-Not $MEM_METRICS_ENABLED_FILTER_REGEXP.Contains($NAME_REGEXP)) {
					$MEM_METRICS_ENABLED_NUMBER_FOUND_SERVERS = $MEM_METRICS_ENABLED_NUMBER_FOUND_SERVERS + 1
					$MEM_METRICS_ENABLED_FILTER_REGEXP= "$MEM_METRICS_ENABLED_FILTER_REGEXP|$NAME_REGEXP" 
				}
			} else {
				$MEM_METRICS_ENABLED_NUMBER_FOUND_SERVERS = $MEM_METRICS_ENABLED_NUMBER_FOUND_SERVERS + 1
				$MEM_METRICS_ENABLED_FILTER_REGEXP = $NAME_REGEXP
			}
		} else {
			
			if ($MEM_METRICS_NOTENABLED_FILTER_REGEXP) {
				if (-Not $MEM_METRICS_NOTENABLED_FILTER_REGEXP.Contains($NAME_REGEXP)) {
					$MEM_METRICS_NOTENABLED_NUMBER_FOUND_SERVERS = $MEM_METRICS_NOTENABLED_NUMBER_FOUND_SERVERS + 1
					$MEM_METRICS_NOTENABLED_FILTER_REGEXP= "$MEM_METRICS_NOTENABLED_FILTER_REGEXP|$NAME_REGEXP" 
				}
			} else {
				$MEM_METRICS_NOTENABLED_NUMBER_FOUND_SERVERS = $MEM_METRICS_NOTENABLED_NUMBER_FOUND_SERVERS + 1
				$MEM_METRICS_NOTENABLED_FILTER_REGEXP = $NAME_REGEXP
			}
			
		}
	}
}



Write-Output ""
Write-Output "***********************************"
Write-Output ""
Write-Output "With Memory metrics enabled"
Write-Output $MEM_METRICS_ENABLED_FILTER_REGEXP
Write-Output ""
Write-Output "***********************************"
Write-Output ""
Write-Output "Without Memory metrics enabled"
Write-Output $MEM_METRICS_NOTENABLED_FILTER_REGEXP