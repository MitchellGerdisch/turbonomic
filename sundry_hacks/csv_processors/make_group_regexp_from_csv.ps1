# This script takes a CSV and produces a big regexp of the VM names that can be used to create a group in Turbo.
#
# CAVEATS/NOTES
#	The output will overwrite the $FILTER_FILE and not check it if already exists.
#
# INPUTS: 
#	COLUMN NAME: The name of the column in the CSV that contains the field you want pulled for the regexp.
#	CSV_FILE: CSV download from Top VMs widget.
#   FILTER_FILE: The path to the file to create containing the regular expression.
#
# OUTPUT: 
#   FILTER_FILE: Contains the regular expression.

param(
[Parameter(Mandatory=$true)][string]$CSV_FILE,
[Parameter(Mandatory=$true)][string]$COL_NAME,
[Parameter(Mandatory=$true)][string]$FILTER_FILE
)

$JSON_STUFF = Import-Csv $CSV_FILE |  ConvertTo-Json  | ConvertFrom-Json

$GROUP_FILTER_REGEXP = ""
foreach ($ITEM in $JSON_STUFF) {
	$NAME = $ITEM.$COL_NAME
	$NAME_REGEXP = "^$NAME$"
	
	if ($GROUP_FILTER_REGEXP) {
		if (-Not $GROUP_FILTER_REGEXP.Contains($NAME_REGEXP)) {
			$GROUP_MEMBERS_COUNT = $GROUP_MEMBERS_COUNT + 1
			$GROUP_FILTER_REGEXP = "$GROUP_FILTER_REGEXP|$NAME_REGEXP" 
		}
	} else {
		$GROUP_FILTER_REGEXP = "$NAME_REGEXP" 
		$GROUP_MEMBERS_COUNT = $GROUP_MEMBERS_COUNT + 1
	}
}

$GROUP_FILTER_REGEXP | Out-File $FILTER_FILE

Write-Output ""
Write-Output "Found $GROUP_MEMBERS_COUNT names."
Write-Output "***********************************"
Write-Output "Filter regular expression can be found in $FILTER_FILE"
Write-Output ""