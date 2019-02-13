Turbonomic API client, tbutil, supports java scripts for processing data.
This repo is used to store some script hacks.

Information about the tbutil client can be found here:
https://greencircle.vmturbo.com/docs/DOC-5897

These javascripts leverage the Turbonomic API client, tbutil and related tbscript capability.
See https://greencircle.vmturbo.com/docs/DOC-5897 for more information on tbutil.

But here are the installation steps in a nutshell:
(NOTE: Although there is a windows-compatible version of tbutil, the javascript capability being ued here is only supported on Linux/Mac.)
 * Go here: https://s3.eu-west-2.amazonaws.com/turbonomic-emea-cs-bucket/tbutil/1.1g/1bb01170f03897422c44a74ff9878d80
 * Download the Linux or Mac zip file
 * Unzip the file
 * cd tbutil-1_1g
 * run the command:
 * sh install.sh
   <br>This will prompt you for where you want to place the tbutil command. 
   <br>Be sure that directory is in your $PATH.

Now set up credentials to allow the client to talk to one or more Turbo instances by running the command:
 * tbutil @TURBO_INSTANCE_NICKNAME save credentials
   <br>Where TURBO_INSTANCE_NICKNAME is however you want to refer to a given Turbo instance when running the script (see below).
   <br>This will prompt you for the Turbo Instance DNS name or IP address and username/password to use.

To run one of these javascripts, 
* Grab the file and save it somewhere on your Linux/Mac machine
* Make the javascript file executable
<br>e.g. chmod +x get_actions_by_cloud_account.js
 
Then just run the javascript and reference the credentials for the given Turbo instance
* e.g. get_actions_by_cloud_account.js -c @TURBO_INSTANCE_NICKNAME
<br>Where TURBO_INSTANCE_NICKNAME is a name you set when saving credentials (see step 6 above).