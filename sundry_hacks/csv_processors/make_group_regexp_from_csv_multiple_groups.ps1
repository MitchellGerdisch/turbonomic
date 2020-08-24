# This script takes a CSV and produces a big regexp of the VM names that can be used to create a group in Turbo.
#
# CAVEATS/NOTES
#	The output will overwrite the $FILTER_FILE and not check it if already exists.
#
# INPUTS: 
#	GROUP COLUMN NAME: Name of column with Application Name
#	COLUMN NAME: The name of the column in the CSV that contains the field you want pulled for the regexp.
#	CSV_FILE: CSV download from Top VMs widget.
#   FILTER_FILE: The path to the file to create containing the regular expression.
#
# OUTPUT: 
#   FILTER_FILE: Contains the regular expression.

param(
[Parameter(Mandatory=$true)][string]$CSV_FILE,
[Parameter(Mandatory=$true)][string]$OUT_FILE,
[Parameter(Mandatory=$true)][string]$GROUP_COL_NAME,
[Parameter(Mandatory=$true)][string]$COL_NAME
)

$JSON_STUFF = Import-Csv $CSV_FILE |  ConvertTo-Json  | ConvertFrom-Json

$GROUP_FILTER_REGEXP = ""
$GROUP_NAME = "NONE"
$NAME_REGEXP = ""
foreach ($ITEM in $JSON_STUFF) {
	if (($ITEM.$GROUP_COL_NAME -ne $GROUP_NAME) -and ($ITEM.$GROUP_COL_NAME -ne "")) {
		# New group found
		# Push out the last group regexp and start a new one
		"$GROUP_NAME,$GROUP_FILTER_REGEXP" | Out-File -Append -FilePath $OUT_FILE
		$GROUP_NAME = $ITEM.$GROUP_COL_NAME
		$GROUP_FILTER_REGEXP = ""
		$NAME_REGEXP = ""
	}

	if ($ITEM.$COL_NAME -ne "") {
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
}

# Final group
"$GROUP_NAME,$GROUP_FILTER_REGEXP" | Out-File -Append $OUT_FILE

Write-Output ""
Write-Output "Found $GROUP_MEMBERS_COUNT names."
Write-Output "***********************************"
Write-Output "Filter regular expression can be found in $FILTER_FILE"
Write-Output ""