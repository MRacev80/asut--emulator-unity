"use strict";
/**
 * server.ts
 * MCP Server for interacting with CODESYS via Python scripting.
 * Implements all MCP resources and tools that interact with the CODESYS environment.
 *
 * IMPORTANT: This server receives configuration as parameters from bin.ts,
 * which helps avoid issues with command-line argument passing in different execution environments.
 * (Incorporates script templates from v1.6.9 and improved tool descriptions)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMcpServer = startMcpServer;
// --- Import 'os' FIRST ---
const os = __importStar(require("os"));
// --- End Import 'os' ---
// --- STARTUP LOG ---
console.error(`>>> SERVER.TS TOP LEVEL EXECUTION @ ${new Date().toISOString()} <<<`);
console.error(`>>> Node: ${process.version}, Platform: ${os.platform()}, Arch: ${os.arch()}`);
console.error(`>>> Initial CWD: ${process.cwd()}`);
// --- End Startup Log ---
// --- Necessary Imports ---
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const codesys_interop_1 = require("./codesys_interop"); // Assumes this utility exists
const path = __importStar(require("path"));
const promises_1 = require("fs/promises"); // For file existence check (async)
// --- Wrap server logic in an exported function ---
function startMcpServer(config) {
    return __awaiter(this, void 0, void 0, function* () {
        console.error(`>>> SERVER.TS startMcpServer() CALLED @ ${new Date().toISOString()} <<<`);
        console.error(`>>> Config Received: ${JSON.stringify(config)}`);
        // --- Use config values directly ---
        const WORKSPACE_DIR = config.workspaceDir;
        const codesysExePath = config.codesysPath;
        const codesysProfileName = config.profileName;
        console.error(`SERVER.TS: Using Workspace Directory: ${WORKSPACE_DIR}`);
        console.error(`SERVER.TS: Using CODESYS Path: ${codesysExePath}`);
        console.error(`SERVER.TS: Using CODESYS Profile: ${codesysProfileName}`);
        // --- Sanity check - confirm the path exists if possible ---
        // This helps catch configuration issues early and prevents runtime failures
        console.error(`SERVER.TS: Checking existence of CODESYS executable: ${codesysExePath}`);
        try {
            // Using sync check here as it's part of initial setup before async operations start
            const fsChecker = require('fs');
            if (!fsChecker.existsSync(codesysExePath)) {
                console.error(`SERVER.TS ERROR: Determined CODESYS executable path does not exist: ${codesysExePath}`);
                // Consider throwing an error instead of exiting if bin.ts handles the catch
                throw new Error(`CODESYS executable not found at specified path: ${codesysExePath}`);
                // process.exit(1); // Avoid process.exit inside library functions if possible
            }
            else {
                console.error(`SERVER.TS: Confirmed CODESYS executable exists.`);
            }
        }
        catch (err) {
            console.error(`SERVER.TS ERROR: Error checking CODESYS path existence: ${err.message}`);
            throw err; // Rethrow the error to be caught by the caller (bin.ts)
            // process.exit(1);
        }
        // --- End Configuration Handling ---
        // --- Helper Function (fileExists - async version) ---
        function fileExists(filePath) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    yield (0, promises_1.stat)(filePath);
                    return true;
                }
                catch (error) {
                    if (error.code === 'ENOENT') {
                        return false; // File does not exist
                    }
                    throw error; // Other error
                }
            });
        }
        // --- End Helper Function ---
        // --- MCP Server Initialization ---
        console.error("SERVER.TS: Initializing McpServer...");
        const server = new mcp_js_1.McpServer({
            name: "CODESYS Control MCP Server",
            version: "1.7.1", // Update version as needed
            capabilities: {
                // Explicitly declare capabilities - enables listChanged notifications if supported by SDK
                resources: { listChanged: true }, // Assuming you might want to notify if resources change dynamically
                tools: { listChanged: true } // Assuming you might want to notify if tools change dynamically (less common)
            }
        });
        console.error("SERVER.TS: McpServer instance created.");
        // --- End MCP Server Initialization ---
        // --- Python Script Templates (Imported from v1.6.9) ---
        const ENSURE_PROJECT_OPEN_PYTHON_SNIPPET = `
import sys
import scriptengine as script_engine
import os
import time
import traceback

# --- Function to ensure the correct project is open ---
MAX_RETRIES = 3
RETRY_DELAY = 2.0 # seconds (use float for time.sleep)

def ensure_project_open(target_project_path):
    print("DEBUG: Ensuring project is open: %s" % target_project_path)
    # Normalize target path once
    normalized_target_path = os.path.normcase(os.path.abspath(target_project_path))

    for attempt in range(MAX_RETRIES):
        print("DEBUG: Ensure project attempt %d/%d for %s" % (attempt + 1, MAX_RETRIES, normalized_target_path))
        primary_project = None
        try:
            # Getting primary project might fail if CODESYS instance is unstable
            primary_project = script_engine.projects.primary
        except Exception as primary_err:
             print("WARN: Error getting primary project: %s. Assuming none." % primary_err)
             # traceback.print_exc() # Optional: Print stack trace for this error
             primary_project = None

        current_project_path = ""
        project_ok = False # Flag to check if target is confirmed primary and accessible

        if primary_project:
            try:
                # Getting path should be relatively safe if primary_project object exists
                current_project_path = os.path.normcase(os.path.abspath(primary_project.path))
                print("DEBUG: Current primary project path: %s" % current_project_path)
                if current_project_path == normalized_target_path:
                    # Found the right project as primary, now check if it's usable
                    print("DEBUG: Target project path matches primary. Checking access...")
                    try:
                         # Try a relatively safe operation to confirm object usability
                         # Getting children count is a reasonable check
                         _ = len(primary_project.get_children(False))
                         print("DEBUG: Target project '%s' is primary and accessible." % target_project_path)
                         project_ok = True
                         return primary_project # SUCCESS CASE 1: Already open and accessible
                    except Exception as access_err:
                         # Project found, but accessing it failed. Might be unstable.
                         print("WARN: Primary project access check failed for '%s': %s. Will attempt reopen." % (current_project_path, access_err))
                         # traceback.print_exc() # Optional: Print stack trace
                         primary_project = None # Force reopen by falling through
                else:
                    # A *different* project is primary
                     print("DEBUG: Primary project is '%s', not the target '%s'." % (current_project_path, normalized_target_path))
                     # Consider closing the wrong project if causing issues, but for now, just open target
                     # try:
                     #     print("DEBUG: Closing incorrect primary project '%s'..." % current_project_path)
                     #     primary_project.close() # Be careful with unsaved changes
                     # except Exception as close_err:
                     #     print("WARN: Failed to close incorrect primary project: %s" % close_err)
                     primary_project = None # Force open target project

            except Exception as path_err:
                 # Failed even to get the path of the supposed primary project
                 print("WARN: Could not get path of current primary project: %s. Assuming not the target." % path_err)
                 # traceback.print_exc() # Optional: Print stack trace
                 primary_project = None # Force open target project

        # If target project not confirmed as primary and accessible, attempt to open/reopen
        if not project_ok:
            # Log clearly whether we are opening initially or reopening
            if primary_project is None and current_project_path == "":
                print("DEBUG: No primary project detected. Attempting to open target: %s" % target_project_path)
            elif primary_project is None and current_project_path != "":
                 print("DEBUG: Primary project was '%s' but failed access check or needed close. Attempting to open target: %s" % (current_project_path, target_project_path))
            else: # Includes cases where wrong project was open
                print("DEBUG: Target project not primary or initial check failed. Attempting to open/reopen: %s" % target_project_path)

            try:
                # Set flags for silent opening, handle potential attribute errors
                update_mode = script_engine.VersionUpdateFlags.NoUpdates | script_engine.VersionUpdateFlags.SilentMode
                # try:
                #     update_mode = script_engine.VersionUpdateFlags.NoUpdates | script_engine.VersionUpdateFlags.SilentMode
                # except AttributeError:
                #     print("WARN: VersionUpdateFlags not found, using integer flags for open (1 | 2 = 3).")
                #     update_mode = 3 # 1=NoUpdates, 2=SilentMode

                opened_project = None
                try:
                     # The actual open call
                     print("DEBUG: Calling script_engine.projects.open('%s', update_flags=%s)..." % (target_project_path, update_mode))
                     opened_project = script_engine.projects.open(target_project_path, update_flags=update_mode)

                     if not opened_project:
                         # This is a critical failure if open returns None without exception
                         print("ERROR: projects.open returned None for %s on attempt %d" % (target_project_path, attempt + 1))
                         # Allow retry loop to continue
                     else:
                         # Open call returned *something*, let's verify
                         print("DEBUG: projects.open call returned an object for: %s" % target_project_path)
                         print("DEBUG: Pausing for stabilization after open...")
                         time.sleep(RETRY_DELAY) # Give CODESYS time
                         # Re-verify: Is the project now primary and accessible?
                         recheck_primary = None
                         try: recheck_primary = script_engine.projects.primary
                         except Exception as recheck_primary_err: print("WARN: Error getting primary project after reopen: %s" % recheck_primary_err)

                         if recheck_primary:
                              recheck_path = ""
                              try: # Getting path might fail
                                  recheck_path = os.path.normcase(os.path.abspath(recheck_primary.path))
                              except Exception as recheck_path_err:
                                  print("WARN: Failed to get path after reopen: %s" % recheck_path_err)

                              if recheck_path == normalized_target_path:
                                   print("DEBUG: Target project confirmed as primary after reopening.")
                                   try: # Final sanity check
                                       _ = len(recheck_primary.get_children(False))
                                       print("DEBUG: Reopened project basic access confirmed.")
                                       return recheck_primary # SUCCESS CASE 2: Successfully opened/reopened
                                   except Exception as access_err_reopen:
                                        print("WARN: Reopened project (%s) basic access check failed: %s." % (normalized_target_path, access_err_reopen))
                                        # traceback.print_exc() # Optional
                                        # Allow retry loop to continue
                              else:
                                   print("WARN: Different project is primary after reopening! Expected '%s', got '%s'." % (normalized_target_path, recheck_path))
                                   # Allow retry loop to continue, maybe it fixes itself
                         else:
                               print("WARN: No primary project found after reopening attempt %d!" % (attempt+1))
                               # Allow retry loop to continue

                except Exception as open_err:
                     # Catch errors during the open call itself
                     print("ERROR: Exception during projects.open call on attempt %d: %s" % (attempt + 1, open_err))
                     traceback.print_exc() # Crucial for diagnosing open failures
                     # Allow retry loop to continue

            except Exception as outer_open_err:
                 # Catch errors in the flag setup etc.
                 print("ERROR: Unexpected error during open setup/logic attempt %d: %s" % (attempt + 1, outer_open_err))
                 traceback.print_exc()

        # If we didn't return successfully in this attempt, wait before retrying
        if attempt < MAX_RETRIES - 1:
            print("DEBUG: Ensure project attempt %d did not succeed. Waiting %f seconds..." % (attempt + 1, RETRY_DELAY))
            time.sleep(RETRY_DELAY)
        else: # Last attempt failed
             print("ERROR: Failed all ensure_project_open attempts for %s." % normalized_target_path)


    # If all retries fail after the loop
    raise RuntimeError("Failed to ensure project '%s' is open and accessible after %d attempts." % (target_project_path, MAX_RETRIES))
# --- End of function ---

# Placeholder for the project file path (must be set in scripts using this snippet)
PROJECT_FILE_PATH = r"{PROJECT_FILE_PATH}"
`;
        const CHECK_STATUS_SCRIPT = `
import sys, scriptengine as script_engine, os, traceback
project_open = False; project_name = "No project open"; project_path = "N/A"; scripting_ok = False
try:
    scripting_ok = True; primary_project = script_engine.projects.primary
    if primary_project:
        project_open = True
        try:
            project_path = os.path.normcase(os.path.abspath(primary_project.path))
            try:
                 project_name = primary_project.get_name() # Might fail
                 if not project_name: project_name = "Unnamed (path: %s)" % os.path.basename(project_path)
            except: project_name = "Unnamed (path: %s)" % os.path.basename(project_path)
        except Exception as e_path: project_path = "N/A (Error: %s)" % e_path; project_name = "Unnamed (Path Error)"
    print("Project Open: %s" % project_open); print("Project Name: %s" % project_name)
    print("Project Path: %s" % project_path); print("Scripting OK: %s" % scripting_ok)
    print("SCRIPT_SUCCESS: Status check complete."); sys.exit(0)
except Exception as e:
    error_message = "Error during status check: %s" % e
    print(error_message); print("Scripting OK: False")
    # traceback.print_exc() # Optional traceback
    print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const OPEN_PROJECT_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
try:
    project = ensure_project_open(PROJECT_FILE_PATH)
    # Get name from object if possible, otherwise use path basename
    proj_name = "Unknown"
    try:
        if project: proj_name = project.get_name() or os.path.basename(PROJECT_FILE_PATH)
        else: proj_name = os.path.basename(PROJECT_FILE_PATH) + " (ensure_project_open returned None?)"
    except Exception:
        proj_name = os.path.basename(PROJECT_FILE_PATH) + " (name retrieval failed)"
    print("Project Opened: %s" % proj_name)
    print("SCRIPT_SUCCESS: Project opened successfully.")
    sys.exit(0)
except Exception as e:
    error_message = "Error opening project %s: %s" % (PROJECT_FILE_PATH, e)
    print(error_message)
    traceback.print_exc()
    print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const CREATE_PROJECT_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, shutil, time, traceback
# Placeholders
TEMPLATE_PROJECT_PATH = r'{TEMPLATE_PROJECT_PATH}' # Path to Standard.project
PROJECT_FILE_PATH = r'{PROJECT_FILE_PATH}'    # Path for the new project (Target Path)
try:
    print("DEBUG: Python script create_project (copy from template):")
    print("DEBUG:   Template Source = %s" % TEMPLATE_PROJECT_PATH)
    print("DEBUG:   Target Path = %s" % PROJECT_FILE_PATH)
    if not PROJECT_FILE_PATH: raise ValueError("Target project file path empty.")
    if not TEMPLATE_PROJECT_PATH: raise ValueError("Template project file path empty.")
    if not os.path.exists(TEMPLATE_PROJECT_PATH): raise IOError("Template project file not found: %s" % TEMPLATE_PROJECT_PATH)

    # 1. Copy the template project file to the new location
    target_dir = os.path.dirname(PROJECT_FILE_PATH)
    if not os.path.exists(target_dir): print("DEBUG: Creating target directory: %s" % target_dir); os.makedirs(target_dir)
    # Check if target file already exists
    if os.path.exists(PROJECT_FILE_PATH): print("WARN: Target project file already exists, overwriting: %s" % PROJECT_FILE_PATH)

    print("DEBUG: Copying '%s' to '%s'..." % (TEMPLATE_PROJECT_PATH, PROJECT_FILE_PATH))
    shutil.copy2(TEMPLATE_PROJECT_PATH, PROJECT_FILE_PATH) # copy2 preserves metadata
    print("DEBUG: File copy complete.")

    # 2. Open the newly copied project file
    print("DEBUG: Opening the copied project: %s" % PROJECT_FILE_PATH)
    # Set flags for silent opening
    update_mode = script_engine.VersionUpdateFlags.NoUpdates | script_engine.VersionUpdateFlags.SilentMode
    # try:
    #     update_mode = script_engine.VersionUpdateFlags.NoUpdates | script_engine.VersionUpdateFlags.SilentMode
    # except AttributeError:
    #     print("WARN: VersionUpdateFlags not found, using integer flags for open (1 | 2 = 3).")
    #     update_mode = 3

    project = script_engine.projects.open(PROJECT_FILE_PATH, update_flags=update_mode)
    print("DEBUG: script_engine.projects.open returned: %s" % project)
    if project:
        print("DEBUG: Pausing briefly after open...")
        time.sleep(1.0) # Allow CODESYS to potentially initialize things
        try:
            print("DEBUG: Explicitly saving project after opening copy...")
            project.save();
            print("DEBUG: Project save after opening copy succeeded.")
        except Exception as save_err:
             print("WARN: Explicit save after opening copy failed: %s" % save_err)
             # Decide if this is critical - maybe not, but good to know.
        print("Project Created from Template Copy at: %s" % PROJECT_FILE_PATH)
        print("SCRIPT_SUCCESS: Project copied from template and opened successfully.")
        sys.exit(0)
    else:
        error_message = "Failed to open project copy %s after copying template %s. projects.open returned None." % (PROJECT_FILE_PATH, TEMPLATE_PROJECT_PATH)
        print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error creating project '%s' from template '%s': %s\\n%s" % (PROJECT_FILE_PATH, TEMPLATE_PROJECT_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: Error copying/opening template: %s" % e); sys.exit(1)
`;
        const SAVE_PROJECT_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    # Get name from object if possible, otherwise use path basename
    project_name = "Unknown"
    try:
        if primary_project: project_name = primary_project.get_name() or os.path.basename(PROJECT_FILE_PATH)
        else: project_name = os.path.basename(PROJECT_FILE_PATH) + " (ensure_project_open returned None?)"
    except Exception:
        project_name = os.path.basename(PROJECT_FILE_PATH) + " (name retrieval failed)"

    print("DEBUG: Saving project: %s (%s)" % (project_name, PROJECT_FILE_PATH))
    primary_project.save()
    print("DEBUG: project.save() executed.")
    print("Project Saved: %s" % project_name)
    print("SCRIPT_SUCCESS: Project saved successfully.")
    sys.exit(0)
except Exception as e:
    error_message = "Error saving project %s: %s" % (PROJECT_FILE_PATH, e)
    print(error_message)
    traceback.print_exc()
    print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const FIND_OBJECT_BY_PATH_PYTHON_SNIPPET = `
import traceback
# --- Find object by path function ---
def find_object_by_path_robust(start_node, full_path, target_type_name="object"):
    print("DEBUG: Finding %s by path: '%s'" % (target_type_name, full_path))
    normalized_path = full_path.replace('\\\\', '/').strip('/')
    path_parts = normalized_path.split('/')
    if not path_parts:
        print("ERROR: Path is empty.")
        return None

    # Determine the actual starting node (project or application)
    project = start_node # Assume start_node is project initially
    if not hasattr(start_node, 'active_application') and hasattr(start_node, 'project'):
         # If start_node is not project but has project ref (e.g., an application), get the project
         try: project = start_node.project
         except Exception as proj_ref_err:
             print("WARN: Could not get project reference from start_node: %s" % proj_ref_err)
             # Proceed assuming start_node might be the project anyway or search fails

    # Try to get the application object robustly if we think we have the project
    app = None
    if hasattr(project, 'active_application'):
        try: app = project.active_application
        except Exception: pass # Ignore errors getting active app
        if not app:
            try:
                 apps = project.find("Application", True) # Search recursively
                 if apps: app = apps[0]
            except Exception: pass

    # Check if the first path part matches the application name
    app_name_lower = ""
    if app:
        try: app_name_lower = (app.get_name() or "application").lower()
        except Exception: app_name_lower = "application" # Fallback

    # Decide where to start the traversal
    current_obj = start_node # Default to the node passed in
    if hasattr(project, 'active_application'): # Only adjust if start_node was likely the project
        if app and path_parts[0].lower() == app_name_lower:
             print("DEBUG: Path starts with Application name '%s'. Beginning search there." % path_parts[0])
             current_obj = app
             path_parts = path_parts[1:] # Consume the app name part
             # If path was *only* the application name
             if not path_parts:
                 print("DEBUG: Target path is the Application object itself.")
                 return current_obj
        else:
            print("DEBUG: Path does not start with Application name. Starting search from project root.")
            current_obj = project # Start search from the project root
    else:
         print("DEBUG: Starting search from originally provided node.")


    # Traverse the remaining path parts
    parent_path_str = getattr(current_obj, 'get_name', lambda: str(current_obj))() # Safer name getting

    for i, part_name in enumerate(path_parts):
        is_last_part = (i == len(path_parts) - 1)
        print("DEBUG: Searching for part [%d/%d]: '%s' under '%s'" % (i+1, len(path_parts), part_name, parent_path_str))
        found_in_parent = None
        try:
            # Prioritize non-recursive find for direct children
            children_of_current = current_obj.get_children(False)
            print("DEBUG: Found %d direct children under '%s'." % (len(children_of_current), parent_path_str))
            for child in children_of_current:
                 child_name = getattr(child, 'get_name', lambda: None)() # Safer name getting
                 # print("DEBUG: Checking child: '%s'" % child_name) # Verbose
                 if child_name == part_name:
                     found_in_parent = child
                     print("DEBUG: Found direct child matching '%s'." % part_name)
                     break # Found direct child, stop searching children

            # If not found directly, AND it's the last part, try recursive find from current parent
            if not found_in_parent and is_last_part:
                 print("DEBUG: Direct find failed for last part '%s'. Trying recursive find under '%s'." % (part_name, parent_path_str))
                 found_recursive_list = current_obj.find(part_name, True) # Recursive find
                 if found_recursive_list:
                     # Maybe add a check here if multiple are found?
                     found_in_parent = found_recursive_list[0] # Take the first match
                     print("DEBUG: Found last part '%s' recursively." % part_name)
                 else:
                     print("DEBUG: Recursive find also failed for last part '%s'." % part_name)

            # Update current object if found
            if found_in_parent:
                current_obj = found_in_parent
                parent_path_str = getattr(current_obj, 'get_name', lambda: part_name)() # Safer name getting
                print("DEBUG: Stepped into '%s'." % parent_path_str)
            else:
                # If not found at any point, the path is invalid from this parent
                print("ERROR: Path part '%s' not found under '%s'." % (part_name, parent_path_str))
                return None # Path broken

        except Exception as find_err:
            print("ERROR: Exception while searching for '%s' under '%s': %s" % (part_name, parent_path_str, find_err))
            traceback.print_exc()
            return None # Error during search

    # Final verification (optional but recommended): Check if the found object's name matches the last part
    final_expected_name = full_path.split('/')[-1]
    found_final_name = getattr(current_obj, 'get_name', lambda: None)() # Safer name getting

    if found_final_name == final_expected_name:
        print("DEBUG: Final %s found and name verified for path '%s': %s" % (target_type_name, full_path, found_final_name))
        return current_obj
    else:
        print("ERROR: Traversal ended on object '%s' but expected final name was '%s'." % (found_final_name, final_expected_name))
        return None # Name mismatch implies target not found as expected

# --- End of find object function ---
`;
        const CREATE_POU_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
${FIND_OBJECT_BY_PATH_PYTHON_SNIPPET}
POU_NAME = "{POU_NAME}"; POU_TYPE_STR = "{POU_TYPE_STR}"; IMPL_LANGUAGE_STR = "{IMPL_LANGUAGE_STR}"; PARENT_PATH_REL = "{PARENT_PATH}"
pou_type_map = { "Program": script_engine.PouType.Program, "FunctionBlock": script_engine.PouType.FunctionBlock, "Function": script_engine.PouType.Function }
# Map common language names to ImplementationLanguages attributes if needed (optional, None usually works)
# lang_map = { "ST": script_engine.ImplementationLanguage.st, ... }

try:
    print("DEBUG: create_pou script: Name='%s', Type='%s', Lang='%s', ParentPath='%s', Project='%s'" % (POU_NAME, POU_TYPE_STR, IMPL_LANGUAGE_STR, PARENT_PATH_REL, PROJECT_FILE_PATH))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    if not POU_NAME: raise ValueError("POU name empty.")
    if not PARENT_PATH_REL: raise ValueError("Parent path empty.")

    # Resolve POU Type Enum
    pou_type_enum = pou_type_map.get(POU_TYPE_STR)
    if not pou_type_enum: raise ValueError("Invalid POU type string: %s. Use Program, FunctionBlock, or Function." % POU_TYPE_STR)

    # Find parent object using the robust function
    parent_object = find_object_by_path_robust(primary_project, PARENT_PATH_REL, "parent container")
    if not parent_object: raise ValueError("Parent object not found for path: %s" % PARENT_PATH_REL)

    parent_name = getattr(parent_object, 'get_name', lambda: str(parent_object))()
    print("DEBUG: Using parent object: %s (Type: %s)" % (parent_name, type(parent_object).__name__))

    # Check if parent object supports creating POUs (should implement ScriptIecLanguageObjectContainer)
    if not hasattr(parent_object, 'create_pou'):
        raise TypeError("Parent object '%s' of type %s does not support create_pou." % (parent_name, type(parent_object).__name__))

    # Set language GUID to None (let CODESYS default based on parent/settings)
    lang_guid = None
    print("DEBUG: Setting language to None (will use default).")
    # Example if mapping language string: lang_guid = lang_map.get(IMPL_LANGUAGE_STR, None)

    print("DEBUG: Calling parent_object.create_pou: Name='%s', Type=%s, Lang=%s" % (POU_NAME, pou_type_enum, lang_guid))

    # Call create_pou using keyword arguments
    new_pou = parent_object.create_pou(
        name=POU_NAME,
        type=pou_type_enum,
        language=lang_guid # Pass None
    )

    print("DEBUG: parent_object.create_pou returned: %s" % new_pou)
    if new_pou:
        new_pou_name = getattr(new_pou, 'get_name', lambda: POU_NAME)()
        print("DEBUG: POU object created: %s" % new_pou_name)

        # --- SAVE THE PROJECT TO PERSIST THE NEW POU ---
        try:
            print("DEBUG: Saving Project...")
            primary_project.save() # Save the overall project file
            print("DEBUG: Project saved successfully after POU creation.")
        except Exception as save_err:
            print("ERROR: Failed to save Project after POU creation: %s" % save_err)
            detailed_error = traceback.format_exc()
            error_message = "Error saving Project after creating POU '%s': %s\\n%s" % (new_pou_name, save_err, detailed_error)
            print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
        # --- END SAVING ---

        print("POU Created: %s" % new_pou_name); print("Type: %s" % POU_TYPE_STR); print("Language: %s (Defaulted)" % IMPL_LANGUAGE_STR); print("Parent Path: %s" % PARENT_PATH_REL)
        print("SCRIPT_SUCCESS: POU created successfully."); sys.exit(0)
    else:
        error_message = "Failed to create POU '%s'. create_pou returned None." % POU_NAME; print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error creating POU '%s' in project '%s': %s\\n%s" % (POU_NAME, PROJECT_FILE_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: Error creating POU '%s': %s" % (POU_NAME, e)); sys.exit(1)
`;
        const SET_POU_CODE_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
${FIND_OBJECT_BY_PATH_PYTHON_SNIPPET}
POU_FULL_PATH = "{POU_FULL_PATH}" # Expecting format like "Application/MyPOU" or "Folder/SubFolder/MyPOU"
DECLARATION_CONTENT = """{DECLARATION_CONTENT}"""
IMPLEMENTATION_CONTENT = """{IMPLEMENTATION_CONTENT}"""

try:
    print("DEBUG: set_pou_code script: POU_FULL_PATH='%s', Project='%s'" % (POU_FULL_PATH, PROJECT_FILE_PATH))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    if not POU_FULL_PATH: raise ValueError("POU full path empty.")

    # Find the target POU/Method/Property object
    target_object = find_object_by_path_robust(primary_project, POU_FULL_PATH, "target object")
    if not target_object: raise ValueError("Target object not found using path: %s" % POU_FULL_PATH)

    target_name = getattr(target_object, 'get_name', lambda: POU_FULL_PATH)()
    print("DEBUG: Found target object: %s" % target_name)

    # --- Set Declaration Part ---
    declaration_updated = False
    # Check if the content is actually provided (might be None/empty if only impl is set)
    has_declaration_content = 'DECLARATION_CONTENT' in locals() or 'DECLARATION_CONTENT' in globals()
    if has_declaration_content and DECLARATION_CONTENT is not None: # Check not None
        if hasattr(target_object, 'textual_declaration'):
            decl_obj = target_object.textual_declaration
            if decl_obj and hasattr(decl_obj, 'replace'):
                try:
                    print("DEBUG: Accessing textual_declaration...")
                    decl_obj.replace(DECLARATION_CONTENT)
                    print("DEBUG: Set declaration text using replace().")
                    declaration_updated = True
                except Exception as decl_err:
                    print("ERROR: Failed to set declaration text: %s" % decl_err)
                    traceback.print_exc() # Print stack trace for detailed error
            else:
                 print("WARN: Target '%s' textual_declaration attribute is None or does not have replace(). Skipping declaration update." % target_name)
        else:
            print("WARN: Target '%s' does not have textual_declaration attribute. Skipping declaration update." % target_name)
    else:
         print("DEBUG: Declaration content not provided or is None. Skipping declaration update.")


    # --- Set Implementation Part ---
    implementation_updated = False
    has_implementation_content = 'IMPLEMENTATION_CONTENT' in locals() or 'IMPLEMENTATION_CONTENT' in globals()
    if has_implementation_content and IMPLEMENTATION_CONTENT is not None: # Check not None
        if hasattr(target_object, 'textual_implementation'):
            impl_obj = target_object.textual_implementation
            if impl_obj and hasattr(impl_obj, 'replace'):
                try:
                    print("DEBUG: Accessing textual_implementation...")
                    impl_obj.replace(IMPLEMENTATION_CONTENT)
                    print("DEBUG: Set implementation text using replace().")
                    implementation_updated = True
                except Exception as impl_err:
                     print("ERROR: Failed to set implementation text: %s" % impl_err)
                     traceback.print_exc() # Print stack trace for detailed error
            else:
                 print("WARN: Target '%s' textual_implementation attribute is None or does not have replace(). Skipping implementation update." % target_name)
        else:
            print("WARN: Target '%s' does not have textual_implementation attribute. Skipping implementation update." % target_name)
    else:
        print("DEBUG: Implementation content not provided or is None. Skipping implementation update.")


    # --- SAVE THE PROJECT TO PERSIST THE CODE CHANGE ---
    # Only save if something was actually updated to avoid unnecessary saves
    if declaration_updated or implementation_updated:
        try:
            print("DEBUG: Saving Project (after code change)...")
            primary_project.save() # Save the overall project file
            print("DEBUG: Project saved successfully after code change.")
        except Exception as save_err:
            print("ERROR: Failed to save Project after setting code: %s" % save_err)
            detailed_error = traceback.format_exc()
            error_message = "Error saving Project after code change for '%s': %s\\n%s" % (target_name, save_err, detailed_error)
            print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
    else:
         print("DEBUG: No code parts were updated, skipping project save.")
    # --- END SAVING ---

    print("Code Set For: %s" % target_name)
    print("Path: %s" % POU_FULL_PATH)
    print("SCRIPT_SUCCESS: Declaration and/or implementation set successfully."); sys.exit(0)

except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error setting code for object '%s' in project '%s': %s\\n%s" % (POU_FULL_PATH, PROJECT_FILE_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const CREATE_PROPERTY_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
${FIND_OBJECT_BY_PATH_PYTHON_SNIPPET}
PARENT_POU_FULL_PATH = "{PARENT_POU_FULL_PATH}" # e.g., "Application/MyFB"
PROPERTY_NAME = "{PROPERTY_NAME}"
PROPERTY_TYPE = "{PROPERTY_TYPE}"
# Optional: Language for Getter/Setter (usually defaults to ST)
# LANG_GUID_STR = "{LANG_GUID_STR}" # Example if needed

try:
    print("DEBUG: create_property script: ParentPOU='%s', Name='%s', Type='%s', Project='%s'" % (PARENT_POU_FULL_PATH, PROPERTY_NAME, PROPERTY_TYPE, PROJECT_FILE_PATH))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    if not PARENT_POU_FULL_PATH: raise ValueError("Parent POU full path empty.")
    if not PROPERTY_NAME: raise ValueError("Property name empty.")
    if not PROPERTY_TYPE: raise ValueError("Property type empty.")

    # Find the parent POU object
    parent_pou_object = find_object_by_path_robust(primary_project, PARENT_POU_FULL_PATH, "parent POU")
    if not parent_pou_object: raise ValueError("Parent POU object not found: %s" % PARENT_POU_FULL_PATH)

    parent_pou_name = getattr(parent_pou_object, 'get_name', lambda: PARENT_POU_FULL_PATH)()
    print("DEBUG: Found Parent POU object: %s" % parent_pou_name)

    # Check if parent object supports creating properties (should implement ScriptIecLanguageMemberContainer)
    if not hasattr(parent_pou_object, 'create_property'):
         raise TypeError("Parent object '%s' of type %s does not support create_property." % (parent_pou_name, type(parent_pou_object).__name__))

    # Default language to None (usually ST)
    lang_guid = None
    print("DEBUG: Calling create_property: Name='%s', Type='%s', Lang=%s" % (PROPERTY_NAME, PROPERTY_TYPE, lang_guid))

    # Call the create_property method ON THE PARENT POU
    new_property_object = parent_pou_object.create_property(
        name=PROPERTY_NAME,
        return_type=PROPERTY_TYPE,
        language=lang_guid # Pass None to use default
    )

    if new_property_object:
        new_prop_name = getattr(new_property_object, 'get_name', lambda: PROPERTY_NAME)()
        print("DEBUG: Property object created: %s" % new_prop_name)

        # --- SAVE THE PROJECT TO PERSIST THE NEW PROPERTY OBJECT ---
        try:
            print("DEBUG: Saving Project (after property creation)...")
            primary_project.save()
            print("DEBUG: Project saved successfully after property creation.")
        except Exception as save_err:
            print("ERROR: Failed to save Project after creating property: %s" % save_err)
            detailed_error = traceback.format_exc()
            error_message = "Error saving Project after creating property '%s': %s\\n%s" % (PROPERTY_NAME, save_err, detailed_error)
            print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
        # --- END SAVING ---

        print("Property Created: %s" % new_prop_name)
        print("Parent POU: %s" % PARENT_POU_FULL_PATH)
        print("Type: %s" % PROPERTY_TYPE)
        print("SCRIPT_SUCCESS: Property created successfully."); sys.exit(0)
    else:
         error_message = "Failed to create property '%s' under '%s'. create_property returned None." % (PROPERTY_NAME, parent_pou_name)
         print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)

except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error creating property '%s' under POU '%s' in project '%s': %s\\n%s" % (PROPERTY_NAME, PARENT_POU_FULL_PATH, PROJECT_FILE_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const CREATE_METHOD_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
${FIND_OBJECT_BY_PATH_PYTHON_SNIPPET}
PARENT_POU_FULL_PATH = "{PARENT_POU_FULL_PATH}" # e.g., "Application/MyFB"
METHOD_NAME = "{METHOD_NAME}"
RETURN_TYPE = "{RETURN_TYPE}" # Can be empty string for no return type
# Optional: Language
# LANG_GUID_STR = "{LANG_GUID_STR}" # Example if needed

try:
    print("DEBUG: create_method script: ParentPOU='%s', Name='%s', ReturnType='%s', Project='%s'" % (PARENT_POU_FULL_PATH, METHOD_NAME, RETURN_TYPE, PROJECT_FILE_PATH))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    if not PARENT_POU_FULL_PATH: raise ValueError("Parent POU full path empty.")
    if not METHOD_NAME: raise ValueError("Method name empty.")
    # RETURN_TYPE can be empty

    # Find the parent POU object
    parent_pou_object = find_object_by_path_robust(primary_project, PARENT_POU_FULL_PATH, "parent POU")
    if not parent_pou_object: raise ValueError("Parent POU object not found: %s" % PARENT_POU_FULL_PATH)

    parent_pou_name = getattr(parent_pou_object, 'get_name', lambda: PARENT_POU_FULL_PATH)()
    print("DEBUG: Found Parent POU object: %s" % parent_pou_name)

     # Check if parent object supports creating methods (should implement ScriptIecLanguageMemberContainer)
    if not hasattr(parent_pou_object, 'create_method'):
         raise TypeError("Parent object '%s' of type %s does not support create_method." % (parent_pou_name, type(parent_pou_object).__name__))

    # Default language to None (usually ST)
    lang_guid = None
    # Use None if RETURN_TYPE is empty string, otherwise use the string
    actual_return_type = RETURN_TYPE if RETURN_TYPE else None
    print("DEBUG: Calling create_method: Name='%s', ReturnType=%s, Lang=%s" % (METHOD_NAME, actual_return_type, lang_guid))

    # Call the create_method method ON THE PARENT POU
    new_method_object = parent_pou_object.create_method(
        name=METHOD_NAME,
        return_type=actual_return_type,
        language=lang_guid # Pass None to use default
    )

    if new_method_object:
        new_meth_name = getattr(new_method_object, 'get_name', lambda: METHOD_NAME)()
        print("DEBUG: Method object created: %s" % new_meth_name)

        # --- SAVE THE PROJECT TO PERSIST THE NEW METHOD OBJECT ---
        try:
            print("DEBUG: Saving Project (after method creation)...")
            primary_project.save()
            print("DEBUG: Project saved successfully after method creation.")
        except Exception as save_err:
            print("ERROR: Failed to save Project after creating method: %s" % save_err)
            detailed_error = traceback.format_exc()
            error_message = "Error saving Project after creating method '%s': %s\\n%s" % (METHOD_NAME, save_err, detailed_error)
            print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
        # --- END SAVING ---

        print("Method Created: %s" % new_meth_name)
        print("Parent POU: %s" % PARENT_POU_FULL_PATH)
        print("Return Type: %s" % (RETURN_TYPE if RETURN_TYPE else "(None)"))
        print("SCRIPT_SUCCESS: Method created successfully."); sys.exit(0)
    else:
         error_message = "Failed to create method '%s' under '%s'. create_method returned None." % (METHOD_NAME, parent_pou_name)
         print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)

except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error creating method '%s' under POU '%s' in project '%s': %s\\n%s" % (METHOD_NAME, PARENT_POU_FULL_PATH, PROJECT_FILE_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const COMPILE_PROJECT_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
try:
    print("DEBUG: compile_project script: Project='%s'" % PROJECT_FILE_PATH)
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    project_name = os.path.basename(PROJECT_FILE_PATH)
    target_app = None
    app_name = "N/A"

    # Try getting active application first
    try:
        target_app = primary_project.active_application
        if target_app:
            app_name = getattr(target_app, 'get_name', lambda: "Unnamed App (Active)")()
            print("DEBUG: Found active application: %s" % app_name)
    except Exception as active_err:
        print("WARN: Could not get active application: %s. Searching..." % active_err)

    # If no active app, search for the first one
    if not target_app:
        print("DEBUG: Searching for first compilable application...")
        apps = []
        try:
             # Search recursively through all project objects
             all_children = primary_project.get_children(True)
             for child in all_children:
                  # Check using the marker property and if build method exists
                  if hasattr(child, 'is_application') and child.is_application and hasattr(child, 'build'):
                       app_name_found = getattr(child, 'get_name', lambda: "Unnamed App")()
                       print("DEBUG: Found potential application object: %s" % app_name_found)
                       apps.append(child)
                       break # Take the first one found
        except Exception as find_err: print("WARN: Error finding application object: %s" % find_err)

        if not apps: raise RuntimeError("No compilable application found in project '%s'" % project_name)
        target_app = apps[0]
        app_name = getattr(target_app, 'get_name', lambda: "Unnamed App (First Found)")()
        print("WARN: Compiling first found application: %s" % app_name)

    print("DEBUG: Calling build() on app '%s'..." % app_name)
    if not hasattr(target_app, 'build'):
         raise TypeError("Selected object '%s' is not an application or doesn't support build()." % app_name)

    # Execute the build
    target_app.build();
    print("DEBUG: Build command executed for application '%s'." % app_name)

    # Check messages is harder without direct access to message store from script.
    # Rely on CODESYS UI or log output for now.
    print("Compile Initiated For Application: %s" % app_name); print("In Project: %s" % project_name)
    print("SCRIPT_SUCCESS: Application compilation initiated."); sys.exit(0)
except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error initiating compilation for project %s: %s\\n%s" % (PROJECT_FILE_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const GET_PROJECT_STRUCTURE_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
# FIND_OBJECT_BY_PATH_PYTHON_SNIPPET is NOT needed here, we start from project root.

def get_object_structure(obj, indent=0, max_depth=10): # Add max_depth
    lines = []; indent_str = "  " * indent
    if indent > max_depth:
        lines.append("%s- Max recursion depth reached." % indent_str)
        return lines
    try:
        name = "Unnamed"; obj_type = type(obj).__name__
        guid_str = ""
        folder_str = ""
        try:
            name = getattr(obj, 'get_name', lambda: "Unnamed")() or "Unnamed" # Safer get_name
            if hasattr(obj, 'guid'): guid_str = " {%s}" % obj.guid
            if hasattr(obj, 'is_folder') and obj.is_folder: folder_str = " [Folder]"
        except Exception as name_err:
             print("WARN: Error getting name/guid/folder status for an object: %s" % name_err)
             name = "!!! Error Getting Name !!!"

        lines.append("%s- %s (%s)%s%s" % (indent_str, name, obj_type, folder_str, guid_str))

        # Get children only if the object potentially has them
        children = []
        can_have_children = hasattr(obj, 'get_children') and (
            not hasattr(obj, 'is_folder') or # If it's not clear if it's a folder (e.g., project root)
            (hasattr(obj, 'is_folder') and obj.is_folder) or # If it is a folder
             # Add known container types explicitly, check marker interfaces too
             hasattr(obj, 'is_project') or hasattr(obj, 'is_application') or hasattr(obj, 'is_device') or hasattr(obj,'is_pou')
        )

        if can_have_children:
            try:
                children = obj.get_children(False)
                # print("DEBUG: %s has %d children" % (name, len(children))) # Verbose
            except Exception as get_child_err:
                lines.append("%s  ERROR getting children: %s" % (indent_str, get_child_err))
                # traceback.print_exc() # Optional

        for child in children:
            lines.extend(get_object_structure(child, indent + 1, max_depth)) # Recurse

    except Exception as e:
        lines.append("%s- Error processing node: %s" % (indent_str, e))
        traceback.print_exc() # Print detailed error for this node
    return lines
try:
    print("DEBUG: Getting structure for: %s" % PROJECT_FILE_PATH)
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    project_name = os.path.basename(PROJECT_FILE_PATH)
    print("DEBUG: Getting structure for project: %s" % project_name)
    # Use the project object obtained from ensure_project_open
    structure_list = get_object_structure(primary_project, max_depth=15) # Set a reasonable depth
    structure_output = "\\n".join(structure_list)
    # Ensure markers are printed distinctly
    print("\\n--- PROJECT STRUCTURE START ---")
    print(structure_output)
    print("--- PROJECT STRUCTURE END ---\\n")
    print("SCRIPT_SUCCESS: Project structure retrieved."); sys.exit(0)
except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error getting structure for %s: %s\\n%s" % (PROJECT_FILE_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        const GET_POU_CODE_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
${FIND_OBJECT_BY_PATH_PYTHON_SNIPPET}
POU_FULL_PATH = "{POU_FULL_PATH}"; CODE_START_MARKER = "### POU CODE START ###"; CODE_END_MARKER = "### POU CODE END ###"
DECL_START_MARKER = "### POU DECLARATION START ###"; DECL_END_MARKER = "### POU DECLARATION END ###"
IMPL_START_MARKER = "### POU IMPLEMENTATION START ###"; IMPL_END_MARKER = "### POU IMPLEMENTATION END ###"

try:
    print("DEBUG: Getting code: POU_FULL_PATH='%s', Project='%s'" % (POU_FULL_PATH, PROJECT_FILE_PATH))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    if not POU_FULL_PATH: raise ValueError("POU full path empty.")

    # Find the target POU/Method/Property object
    target_object = find_object_by_path_robust(primary_project, POU_FULL_PATH, "target object")
    if not target_object: raise ValueError("Target object not found using path: %s" % POU_FULL_PATH)

    target_name = getattr(target_object, 'get_name', lambda: POU_FULL_PATH)()
    print("DEBUG: Found target object: %s" % target_name)

    declaration_code = ""; implementation_code = ""

    # --- Get Declaration Part ---
    if hasattr(target_object, 'textual_declaration'):
        decl_obj = target_object.textual_declaration
        if decl_obj and hasattr(decl_obj, 'text'):
            try:
                declaration_code = decl_obj.text
                print("DEBUG: Got declaration text.")
            except Exception as decl_read_err:
                print("ERROR: Failed to read declaration text: %s" % decl_read_err)
                declaration_code = "/* ERROR reading declaration: %s */" % decl_read_err
        else:
            print("WARN: textual_declaration exists but is None or has no 'text' attribute.")
    else:
        print("WARN: No textual_declaration attribute.")

    # --- Get Implementation Part ---
    if hasattr(target_object, 'textual_implementation'):
        impl_obj = target_object.textual_implementation
        if impl_obj and hasattr(impl_obj, 'text'):
            try:
                implementation_code = impl_obj.text
                print("DEBUG: Got implementation text.")
            except Exception as impl_read_err:
                print("ERROR: Failed to read implementation text: %s" % impl_read_err)
                implementation_code = "/* ERROR reading implementation: %s */" % impl_read_err
        else:
            print("WARN: textual_implementation exists but is None or has no 'text' attribute.")
    else:
        print("WARN: No textual_implementation attribute.")


    print("Code retrieved for: %s" % target_name)
    # Print declaration between markers, ensuring markers are on separate lines
    print("\\n" + DECL_START_MARKER)
    print(declaration_code)
    print(DECL_END_MARKER + "\\n")
    # Print implementation between markers
    print(IMPL_START_MARKER)
    print(implementation_code)
    print(IMPL_END_MARKER + "\\n")

    # --- LEGACY MARKERS for backward compatibility if needed ---
    # Combine both for old marker format, adding a separator line
    # legacy_combined_code = declaration_code + "\\n\\n// Implementation\\n" + implementation_code
    # print(CODE_START_MARKER); print(legacy_combined_code); print(CODE_END_MARKER)
    # --- END LEGACY ---

    print("SCRIPT_SUCCESS: Code retrieved."); sys.exit(0)
except Exception as e:
    detailed_error = traceback.format_exc()
    error_message = "Error getting code for object '%s' in project '%s': %s\\n%s" % (POU_FULL_PATH, PROJECT_FILE_PATH, e, detailed_error)
    print(error_message); print("SCRIPT_ERROR: %s" % error_message); sys.exit(1)
`;
        // --- End Python Script Templates ---
        // --- Zod Schemas (moved for clarity before usage) ---
        const PouTypeEnum = zod_1.z.enum(["Program", "FunctionBlock", "Function"]);
        const ImplementationLanguageEnum = zod_1.z.enum(["ST", "LD", "FBD", "SFC", "IL", "CFC", "StructuredText", "LadderDiagram", "FunctionBlockDiagram", "SequentialFunctionChart", "InstructionList", "ContinuousFunctionChart"]);
        // --- End Zod Schemas ---
        // --- MCP Resources / Tools Definitions ---
        console.error("SERVER.TS: Defining Resources and Tools...");
        // --- Resources ---
        server.resource("project-status", "codesys://project/status", (uri) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            console.error(`SERVER.TS Resource request: ${uri.href}`);
            try {
                const result = yield (0, codesys_interop_1.executeCodesysScript)(CHECK_STATUS_SCRIPT, codesysExePath, codesysProfileName);
                const outputLines = result.output.split(/[\r\n]+/).filter(line => line.trim());
                const statusData = {};
                outputLines.forEach(line => { const match = line.match(/^([^:]+):\s*(.*)$/); if (match) {
                    statusData[match[1].trim()] = match[2].trim();
                } });
                const statusText = `CODESYS Status:\n - Scripting OK: ${(_a = statusData['Scripting OK']) !== null && _a !== void 0 ? _a : 'Unknown'}\n - Project Open: ${(_b = statusData['Project Open']) !== null && _b !== void 0 ? _b : 'Unknown'}\n - Project Name: ${(_c = statusData['Project Name']) !== null && _c !== void 0 ? _c : 'Unknown'}\n - Project Path: ${(_d = statusData['Project Path']) !== null && _d !== void 0 ? _d : 'N/A'}`;
                const isError = !result.success || ((_e = statusData['Scripting OK']) === null || _e === void 0 ? void 0 : _e.toLowerCase()) !== 'true';
                // **** RETURN MCP STRUCTURE ****
                return { contents: [{ uri: uri.href, text: statusText, contentType: "text/plain" }], isError: isError };
            }
            catch (error) {
                console.error(`Error resource ${uri.href}:`, error);
                // **** RETURN MCP STRUCTURE ****
                return { contents: [{ uri: uri.href, text: `Failed status script: ${error.message}`, contentType: "text/plain" }], isError: true };
            }
        }));
        // *** DEFINE TEMPLATES ***
        const projectStructureTemplate = new mcp_js_1.ResourceTemplate("codesys://project/{+project_path}/structure", { list: undefined });
        const pouCodeTemplate = new mcp_js_1.ResourceTemplate("codesys://project/{+project_path}/pou/{+pou_path}/code", { list: undefined });
        // *** END DEFINE TEMPLATES ***
        server.resource("project-structure", projectStructureTemplate, (uri, params) => __awaiter(this, void 0, void 0, function* () {
            // *** DEFINE VARIABLES (like projectPath) ***
            const projectPathParam = params.project_path;
            if (typeof projectPathParam !== 'string') {
                return { contents: [{ uri: uri.href, text: `Error: Invalid project path type (${typeof projectPathParam}).`, contentType: "text/plain" }], isError: true };
            }
            const projectPath = projectPathParam; // Define projectPath
            if (!projectPath) {
                return { contents: [{ uri: uri.href, text: "Error: Project path missing.", contentType: "text/plain" }], isError: true };
            }
            // *** END DEFINE VARIABLES ***
            console.error(`Resource request: project structure for ${projectPath}`);
            try {
                const absoluteProjPath = path.normalize(path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath));
                const escapedPathForPython = absoluteProjPath.replace(/\\/g, '\\\\');
                // *** DEFINE scriptContent ***
                const scriptContent = GET_PROJECT_STRUCTURE_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escapedPathForPython);
                // *** END DEFINE scriptContent ***
                const result = yield (0, codesys_interop_1.executeCodesysScript)(scriptContent, codesysExePath, codesysProfileName);
                let structureText = `Error retrieving structure for ${absoluteProjPath}.\n\n${result.output}`;
                let isError = !result.success;
                if (result.success && result.output.includes("SCRIPT_SUCCESS")) {
                    const startMarker = "--- PROJECT STRUCTURE START ---";
                    const endMarker = "--- PROJECT STRUCTURE END ---";
                    const startIndex = result.output.indexOf(startMarker);
                    const endIndex = result.output.indexOf(endMarker);
                    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                        structureText = result.output.substring(startIndex + startMarker.length, endIndex).replace(/\\n/g, '\n').trim();
                    }
                    else {
                        console.error("Error: Could not find structure markers in script output.");
                        structureText = `Could not parse structure markers in output for ${absoluteProjPath}.\n\nOutput:\n${result.output}`;
                        isError = true;
                    }
                }
                else {
                    isError = true;
                }
                // **** RETURN MCP STRUCTURE ****
                return { contents: [{ uri: uri.href, text: structureText, contentType: "text/plain" }], isError: isError };
            }
            catch (error) {
                console.error(`Error getting structure ${uri.href}:`, error);
                // **** RETURN MCP STRUCTURE ****
                return { contents: [{ uri: uri.href, text: `Failed structure script for '${projectPath}': ${error.message}`, contentType: "text/plain" }], isError: true };
            }
        }));
        server.resource("pou-code", pouCodeTemplate, (uri, params) => __awaiter(this, void 0, void 0, function* () {
            // *** DEFINE VARIABLES (like projectPath, pouPath) ***
            const projectPathParam = params.project_path;
            const pouPathParam = params.pou_path;
            if (typeof projectPathParam !== 'string' || typeof pouPathParam !== 'string') {
                return { contents: [{ uri: uri.href, text: "Error: Invalid project or POU path type.", contentType: "text/plain" }], isError: true };
            }
            const projectPath = projectPathParam; // Define projectPath
            const pouPath = pouPathParam; // Define pouPath
            if (!projectPath || !pouPath) {
                return { contents: [{ uri: uri.href, text: "Error: Project or POU path missing.", contentType: "text/plain" }], isError: true };
            }
            // *** END DEFINE VARIABLES ***
            console.error(`Resource request: POU code: Project='${projectPath}', POU='${pouPath}'`);
            try {
                const absoluteProjPath = path.normalize(path.isAbsolute(projectPath) ? projectPath : path.join(WORKSPACE_DIR, projectPath));
                const sanitizedPouPath = String(pouPath).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
                const escapedProjPath = absoluteProjPath.replace(/\\/g, '\\\\');
                // *** DEFINE scriptContent ***
                let scriptContent = GET_POU_CODE_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escapedProjPath);
                scriptContent = scriptContent.replace("{POU_FULL_PATH}", sanitizedPouPath);
                // *** END DEFINE scriptContent ***
                const result = yield (0, codesys_interop_1.executeCodesysScript)(scriptContent, codesysExePath, codesysProfileName);
                let codeText = `Error retrieving code for object '${sanitizedPouPath}' in project '${absoluteProjPath}'.\n\n${result.output}`;
                let isError = !result.success;
                if (result.success && result.output.includes("SCRIPT_SUCCESS")) {
                    // ... (marker parsing logic using new markers) ...
                    const declStartMarker = "### POU DECLARATION START ###";
                    const declEndMarker = "### POU DECLARATION END ###";
                    const implStartMarker = "### POU IMPLEMENTATION START ###";
                    const implEndMarker = "### POU IMPLEMENTATION END ###";
                    const declStartIdx = result.output.indexOf(declStartMarker);
                    const declEndIdx = result.output.indexOf(declEndMarker);
                    const implStartIdx = result.output.indexOf(implStartMarker);
                    const implEndIdx = result.output.indexOf(implEndMarker);
                    let declaration = "/* Declaration not found in output */";
                    let implementation = "/* Implementation not found in output */";
                    if (declStartIdx !== -1 && declEndIdx !== -1 && declStartIdx < declEndIdx) {
                        declaration = result.output.substring(declStartIdx + declStartMarker.length, declEndIdx).replace(/\\n/g, '\n').trim();
                    }
                    else {
                        console.error(`WARN: Declaration markers not found correctly for ${sanitizedPouPath}`);
                    }
                    if (implStartIdx !== -1 && implEndIdx !== -1 && implStartIdx < implEndIdx) {
                        implementation = result.output.substring(implStartIdx + implStartMarker.length, implEndIdx).replace(/\\n/g, '\n').trim();
                    }
                    else {
                        console.error(`WARN: Implementation markers not found correctly for ${sanitizedPouPath}`);
                    }
                    codeText = `// ----- Declaration -----\n${declaration}\n\n// ----- Implementation -----\n${implementation}`;
                    // *** END MARKER PARSING ***
                }
                else {
                    isError = true;
                }
                // **** RETURN MCP STRUCTURE ****
                return { contents: [{ uri: uri.href, text: codeText, contentType: "text/plain" }], isError: isError };
            }
            catch (error) {
                console.error(`Error getting POU code ${uri.href}:`, error);
                // **** RETURN MCP STRUCTURE ****
                return { contents: [{ uri: uri.href, text: `Failed POU code script for '${pouPath}' in '${projectPath}': ${error.message}`, contentType: "text/plain" }], isError: true };
            }
        }));
        // --- End Resources ---
        // --- Tools ---
        server.tool("open_project", // Tool Name
        "Opens an existing CODESYS project file.", // Tool Description
        {
            filePath: zod_1.z.string().describe("Path to the project file (e.g., 'C:/Projects/MyPLC.project' or '/Users/user/projects/my_project.project').")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { filePath } = args;
            let absPath = path.normalize(path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE_DIR, filePath));
            console.error(`Tool call: open_project: ${absPath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = OPEN_PROJECT_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escapedPath);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                return { content: [{ type: "text", text: success ? `Project opened: ${absPath}` : `Failed open project ${absPath}. Output:\n${result.output}` }], isError: !success };
            }
            catch (e) {
                console.error(`Error open_project ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        server.tool("create_project", // Tool Name
        "Creates a new CODESYS project from the standard template.", // Tool Description
        {
            filePath: zod_1.z.string().describe("Path where the new project file should be created (e.g., 'C:/Projects/NewPLC.project' or '/Users/user/projects/new_project.project').")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { filePath } = args;
            let absPath = path.normalize(path.isAbsolute(filePath) ? filePath : path.join(WORKSPACE_DIR, filePath));
            console.error(`Tool call: create_project (copy template): ${absPath}`);
            let templatePath = "";
            try {
                // Template finding logic (same as before)
                const baseDir = path.dirname(path.dirname(codesysExePath));
                templatePath = path.normalize(path.join(baseDir, 'Templates', 'Standard.project'));
                if (!(yield fileExists(templatePath))) {
                    console.error(`WARN: Template not found relative to exe: ${templatePath}. Trying ProgramData...`);
                    const programData = process.env.ALLUSERSPROFILE || process.env.ProgramData || 'C:\\ProgramData';
                    const possibleTemplateDir = path.join(programData, 'CODESYS', 'CODESYS', codesysProfileName, 'Templates');
                    let potentialTemplatePath = path.normalize(path.join(possibleTemplateDir, 'Standard.project'));
                    if (yield fileExists(potentialTemplatePath)) {
                        templatePath = potentialTemplatePath;
                        console.error(`DEBUG: Found template in ProgramData: ${templatePath}`);
                    }
                    else {
                        const alternativeTemplateDir = path.join(programData, 'CODESYS', 'Templates');
                        potentialTemplatePath = path.normalize(path.join(alternativeTemplateDir, 'Standard.project'));
                        if (yield fileExists(potentialTemplatePath)) {
                            templatePath = potentialTemplatePath;
                            console.error(`DEBUG: Found template in ProgramData (alternative): ${templatePath}`);
                        }
                        else {
                            throw new Error(`Standard template project file not found at relative path or ProgramData locations.`);
                        }
                    }
                }
                else {
                    console.error(`DEBUG: Found template relative to exe: ${templatePath}`);
                }
                // *** END TEMPLATE FINDING ***
            }
            catch (e) {
                console.error(`Template Error: ${e.message}`);
                return { content: [{ type: "text", text: `Template Error: ${e.message}` }], isError: true };
            }
            try {
                const escProjPath = absPath.replace(/\\/g, '\\\\');
                const escTmplPath = templatePath.replace(/\\/g, '\\\\');
                const script = CREATE_PROJECT_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", escProjPath)
                    .replace("{TEMPLATE_PROJECT_PATH}", escTmplPath);
                console.error(">>> create_project (copy-then-open): PREPARED SCRIPT:", script.substring(0, 500) + "...");
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                console.error(">>> create_project (copy-then-open): EXECUTION RESULT:", JSON.stringify(result));
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                return { content: [{ type: "text", text: success ? `Project created from template: ${absPath}` : `Failed create project ${absPath} from template. Output:\n${result.output}` }], isError: !success };
            }
            catch (e) {
                console.error(`Error create_project ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        server.tool("save_project", // Tool Name
        "Saves the currently open CODESYS project.", // Tool Description
        {
            projectFilePath: zod_1.z.string().describe("Path to the project file to ensure is open before saving (e.g., 'C:/Projects/MyPLC.project').")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath } = args;
            let absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: save_project: ${absPath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = SAVE_PROJECT_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escapedPath);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                return { content: [{ type: "text", text: success ? `Project saved: ${absPath}` : `Failed save project ${absPath}. Output:\n${result.output}` }], isError: !success };
            }
            catch (e) {
                console.error(`Error save_project ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        server.tool("create_pou", // Tool Name
        "Creates a new Program, Function Block, or Function POU within the specified CODESYS project.", // Tool Description
        {
            projectFilePath: zod_1.z.string().describe("Path to the project file (e.g., 'C:/Projects/MyPLC.project')."),
            name: zod_1.z.string().describe("Name for the new POU (must be a valid IEC identifier)."),
            type: PouTypeEnum.describe("Type of POU (Program, FunctionBlock, Function)."),
            language: ImplementationLanguageEnum.describe("Implementation language (ST, LD, FBD, etc.). CODESYS default will be used if specific language is not set or directly supported by scripting for this POU type."),
            parentPath: zod_1.z.string().describe("Relative path under project root or application where the POU should be created (e.g., 'Application' or 'MyFolder/SubFolder').")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, name, type, language, parentPath } = args;
            let absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            const sanParentPath = parentPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const sanName = name.trim();
            console.error(`Tool call: create_pou: Name='${sanName}', Type='${type}', Lang='${language}', Parent='${sanParentPath}', Project='${absPath}'`);
            try {
                const escProjPath = absPath.replace(/\\/g, '\\\\');
                let script = CREATE_POU_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escProjPath);
                script = script.replace("{POU_NAME}", sanName);
                script = script.replace("{POU_TYPE_STR}", type);
                script = script.replace("{IMPL_LANGUAGE_STR}", language);
                script = script.replace("{PARENT_PATH}", sanParentPath);
                console.error(">>> create_pou: PREPARED SCRIPT:", script.substring(0, 500) + "...");
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                console.error(">>> create_pou: EXECUTION RESULT:", JSON.stringify(result));
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                return { content: [{ type: "text", text: success ? `POU '${sanName}' created in '${sanParentPath}' of ${absPath}. Project saved.` : `Failed create POU '${sanName}'. Output:\n${result.output}` }], isError: !success };
            }
            catch (e) {
                console.error(`Error create_pou ${sanName} in ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        server.tool("set_pou_code", // Tool Name
        "Sets the declaration and/or implementation code for a specific POU, Method, or Property.", // Tool Description
        {
            projectFilePath: zod_1.z.string().describe("Path to the project file (e.g., 'C:/Projects/MyPLC.project')."),
            pouPath: zod_1.z.string().describe("Full relative path to the target object (e.g., 'Application/MyPOU', 'MyFolder/MyFB/MyMethod', 'MyFolder/MyFB/MyProperty')."),
            declarationCode: zod_1.z.string().describe("Code for the declaration part (VAR...END_VAR). If omitted, the declaration is not changed.").optional(),
            implementationCode: zod_1.z.string().describe("Code for the implementation logic part. If omitted, the implementation is not changed.").optional()
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, pouPath, declarationCode, implementationCode } = args;
            if (declarationCode === undefined && implementationCode === undefined) {
                return { content: [{ type: "text", text: "Error: At least one of declarationCode or implementationCode must be provided." }], isError: true };
            }
            let absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            const sanPouPath = pouPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            console.error(`Tool call: set_pou_code: Target='${sanPouPath}', Project='${absPath}'`);
            try {
                const escProjPath = absPath.replace(/\\/g, '\\\\');
                // Escape content for Python triple-quoted strings
                const sanDeclCode = (declarationCode !== null && declarationCode !== void 0 ? declarationCode : "").replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
                const sanImplCode = (implementationCode !== null && implementationCode !== void 0 ? implementationCode : "").replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
                let script = SET_POU_CODE_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escProjPath);
                script = script.replace("{POU_FULL_PATH}", sanPouPath);
                script = script.replace("{DECLARATION_CONTENT}", sanDeclCode);
                script = script.replace("{IMPLEMENTATION_CONTENT}", sanImplCode);
                console.error(">>> set_pou_code: PREPARED SCRIPT:", script.substring(0, 500) + "...");
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                console.error(">>> set_pou_code: EXECUTION RESULT:", JSON.stringify(result));
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                return { content: [{ type: "text", text: success ? `Code set for '${sanPouPath}' in ${absPath}. Project saved.` : `Failed set code for '${sanPouPath}'. Output:\n${result.output}` }], isError: !success };
            }
            catch (e) {
                console.error(`Error set_pou_code ${sanPouPath} in ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        server.tool("create_property", // Tool Name
        "Creates a new Property within a specific Function Block POU.", // Tool Description
        {
            projectFilePath: zod_1.z.string().describe("Path to the project file (e.g., 'C:/Projects/MyPLC.project')."),
            // Assuming properties can only be added to FBs in standard CODESYS scripting
            parentPouPath: zod_1.z.string().describe("Relative path to the parent Function Block POU (e.g., 'Application/MyFB')."),
            propertyName: zod_1.z.string().describe("Name for the new property (must be a valid IEC identifier)."),
            propertyType: zod_1.z.string().describe("Data type of the property (e.g., 'BOOL', 'INT', 'MyDUT').")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, parentPouPath, propertyName, propertyType } = args;
            let absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            const sanParentPath = parentPouPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const sanPropName = propertyName.trim();
            const sanPropType = propertyType.trim();
            console.error(`Tool call: create_property: Name='${sanPropName}', Type='${sanPropType}', ParentPOU='${sanParentPath}', Project='${absPath}'`);
            if (!sanPropName || !sanPropType) {
                return { content: [{ type: "text", text: `Error: Property name and type cannot be empty.` }], isError: true };
            }
            try {
                const escProjPath = absPath.replace(/\\/g, '\\\\');
                let script = CREATE_PROPERTY_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escProjPath);
                script = script.replace("{PARENT_POU_FULL_PATH}", sanParentPath);
                script = script.replace("{PROPERTY_NAME}", sanPropName);
                script = script.replace("{PROPERTY_TYPE}", sanPropType);
                console.error(">>> create_property: PREPARED SCRIPT:", script.substring(0, 500) + "...");
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                console.error(">>> create_property: EXECUTION RESULT:", JSON.stringify(result));
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                return {
                    content: [{ type: "text", text: success ? `Property '${sanPropName}' created under '${sanParentPath}' in ${absPath}. Project saved.` : `Failed to create property '${sanPropName}'. Output:\n${result.output}` }],
                    isError: !success
                };
            }
            catch (e) {
                console.error(`Error create_property ${sanPropName} in ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        server.tool("create_method", // Tool Name
        "Creates a new Method within a specific Function Block POU.", // Tool Description
        {
            projectFilePath: zod_1.z.string().describe("Path to the project file (e.g., 'C:/Projects/MyPLC.project')."),
            // Assuming methods can typically only be added to FBs in standard CODESYS scripting
            parentPouPath: zod_1.z.string().describe("Relative path to the parent Function Block POU (e.g., 'Application/MyFB')."),
            methodName: zod_1.z.string().describe("Name of the new method (must be a valid IEC identifier)."),
            returnType: zod_1.z.string().optional().describe("Return type (e.g., 'BOOL', 'INT'). Leave empty or omit for no return value (PROCEDURE)."),
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, parentPouPath, methodName, returnType } = args;
            let absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            const sanParentPath = parentPouPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            const sanMethName = methodName.trim();
            const sanReturnType = (returnType !== null && returnType !== void 0 ? returnType : "").trim();
            console.error(`Tool call: create_method: Name='${sanMethName}', Return='${sanReturnType}', ParentPOU='${sanParentPath}', Project='${absPath}'`);
            if (!sanMethName) {
                return { content: [{ type: "text", text: `Error: Method name cannot be empty.` }], isError: true };
            }
            try {
                const escProjPath = absPath.replace(/\\/g, '\\\\');
                let script = CREATE_METHOD_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escProjPath);
                script = script.replace("{PARENT_POU_FULL_PATH}", sanParentPath);
                script = script.replace("{METHOD_NAME}", sanMethName);
                script = script.replace("{RETURN_TYPE}", sanReturnType);
                console.error(">>> create_method: PREPARED SCRIPT:", script.substring(0, 500) + "...");
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                console.error(">>> create_method: EXECUTION RESULT:", JSON.stringify(result));
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                return {
                    content: [{ type: "text", text: success ? `Method '${sanMethName}' created under '${sanParentPath}' in ${absPath}. Project saved.` : `Failed to create method '${sanMethName}'. Output:\n${result.output}` }],
                    isError: !success
                };
            }
            catch (e) {
                console.error(`Error create_method ${sanMethName} in ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        server.tool("compile_project", // Tool Name
        "Compiles (Builds) the primary application within a CODESYS project.", // Tool Description
        {
            projectFilePath: zod_1.z.string().describe("Path to the project file containing the application to compile (e.g., 'C:/Projects/MyPLC.project').")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath } = args;
            let absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: compile_project: ${absPath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = COMPILE_PROJECT_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escapedPath);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                // Check for actual compile errors in the output log
                const hasCompileErrors = result.output.includes("Compile complete --") && !/ 0 error\(s\),/.test(result.output);
                let message = success ? `Compilation initiated for application in ${absPath}. Check CODESYS messages for results.` : `Failed initiating compilation for ${absPath}. Output:\n${result.output}`;
                let isError = !success; // Base error status on script success
                if (success && hasCompileErrors) {
                    message += " WARNING: Build command reported errors in the output log.";
                    console.warn("Compile project reported build errors in the output.");
                    // Report as error if compile fails, even if script technically succeeded
                    isError = true;
                }
                return { content: [{ type: "text", text: message }], isError: isError };
            }
            catch (e) {
                console.error(`Error compile_project ${absPath}: ${e}`);
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        // --- manage_library tool ---
        const MANAGE_LIBRARY_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
ACTION = "{ACTION}"
LIBRARY_NAME = "{LIBRARY_NAME}"
try:
    print("DEBUG: manage_library: action=%s lib=%s project=%s" % (ACTION, LIBRARY_NAME, PROJECT_FILE_PATH))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    target_app = primary_project.active_application
    if not target_app:
        for child in primary_project.get_children(True):
            if hasattr(child, 'is_application') and child.is_application:
                target_app = child
                break
    if not target_app:
        raise RuntimeError("No application found in project")
    lib_man = target_app.get_library_manager()
    if ACTION == "add":
        found = False
        for repo in librarymanager.repositories:
            for lib in librarymanager.get_all_libraries(repo):
                if lib.title.lower() == LIBRARY_NAME.lower():
                    lib_man.add_placeholder(lib.title, lib)
                    print("SCRIPT_SUCCESS: Library '%s' added." % lib.displayname)
                    found = True
                    break
            if found:
                break
        if not found:
            raise RuntimeError("Library '%s' not found in any repository" % LIBRARY_NAME)
    elif ACTION == "remove":
        lib_man.remove_library(LIBRARY_NAME)
        print("SCRIPT_SUCCESS: Library '%s' removed." % LIBRARY_NAME)
    elif ACTION == "list":
        refs = lib_man.references
        lines = []
        for r in refs:
            try:
                name = r.namespace if hasattr(r, 'namespace') else str(r)
                lines.append(name)
            except:
                lines.append(str(r))
        print("SCRIPT_SUCCESS: Libraries: " + ", ".join(lines))
    else:
        raise RuntimeError("Unknown action: %s. Use add/remove/list" % ACTION)
    primary_project.save()
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("manage_library",
        "Add, remove or list libraries in a CODESYS project. Actions: add, remove, list.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            action: zod_1.z.enum(["add", "remove", "list"]).describe("Action: add / remove / list"),
            libraryName: zod_1.z.string().optional().describe("Library name, e.g. 'IoStandard'. Required for add/remove.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, action, libraryName = "" } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: manage_library action=${action} lib=${libraryName} path=${absPath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = MANAGE_LIBRARY_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", escapedPath)
                    .replace("{ACTION}", action)
                    .replace("{LIBRARY_NAME}", libraryName);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed: ${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        // --- get_project_variables tool ---
        const GET_PROJECT_VARIABLES_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
try:
    print("DEBUG: get_project_variables: project=%s" % PROJECT_FILE_PATH)
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    target_app = primary_project.active_application
    if not target_app:
        for child in primary_project.get_children(True):
            if hasattr(child, 'is_application') and child.is_application:
                target_app = child
                break
    if not target_app:
        raise RuntimeError("No application found in project")
    results = []
    all_objects = primary_project.get_children(True)
    for obj in all_objects:
        if hasattr(obj, 'is_pou') and obj.is_pou:
            try:
                name = obj.get_name()
                text_doc = obj.get_textual_declaration()
                if text_doc:
                    code = text_doc.text
                    results.append("=== %s ===" % name)
                    results.append(code)
            except Exception as ex:
                results.append("=== %s === (error: %s)" % (str(obj), ex))
    output = "\\n".join(results) if results else "No POUs found"
    print("SCRIPT_SUCCESS: " + output)
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("get_project_variables",
        "Returns declarations (variables) of all POUs in a CODESYS project.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: get_project_variables path=${absPath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = GET_PROJECT_VARIABLES_SCRIPT_TEMPLATE.replace("{PROJECT_FILE_PATH}", escapedPath);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed: ${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        // --- get_compile_messages tool ---
        const GET_COMPILE_MESSAGES_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
FILTER = "{FILTER}"
def format_msg(msg):
    sev  = str(getattr(msg, 'severity',    '')).lower()
    desc = str(getattr(msg, 'description', str(msg)))
    obj  = str(getattr(msg, 'object_name', ''))
    pos  = str(getattr(msg, 'position',    ''))
    line = "[%s] %s" % (sev.upper() if sev else "?", desc)
    if obj: line += " | obj: %s" % obj
    if pos: line += " | pos: %s" % pos
    return sev, line
try:
    print("DEBUG: get_compile_messages: project=%s filter=%s" % (PROJECT_FILE_PATH, FILTER))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    results = []
    msg_center = None
    # Try different API variants (SP17 vs SP21+)
    for attr in ['messagecenter', 'message_center', 'MessageCenter']:
        try:
            msg_center = getattr(script_engine, attr)
            print("DEBUG: found message center via script_engine.%s" % attr)
            break
        except AttributeError:
            pass
    if msg_center is None:
        try:
            msg_center = primary_project.get_message_center()
            print("DEBUG: found message center via project.get_message_center()")
        except Exception:
            pass
    if msg_center is not None:
        try:
            messages = msg_center.get_all_messages()
        except Exception:
            messages = list(msg_center)
        for msg in messages:
            try:
                sev, line = format_msg(msg)
                if FILTER == "all" or FILTER in sev:
                    results.append(line)
            except Exception as me:
                results.append("[?] %s" % str(msg))
    else:
        # Fallback: read from CODESYS log file
        log_path = r"C:\\ProgramData\\CODESYS\\CODESYSControlWinV3\\FA001425\\CODESYS Control Win V3.log"
        results.append("WARN: message_center API not available in this CODESYS version.")
        results.append("Fallback: reading runtime log...")
        try:
            with open(log_path, 'r') as f:
                lines = f.readlines()
            for l in lines[-30:]:
                l = l.strip()
                if not l: continue
                if FILTER == "all":
                    results.append(l)
                elif FILTER == "error"   and ("error" in l.lower() or "fault" in l.lower()):
                    results.append(l)
                elif FILTER == "warning" and "warn" in l.lower():
                    results.append(l)
        except Exception as log_err:
            results.append("Could not read log: %s" % log_err)
    output = "\\n".join(results) if results else "No messages (filter=%s)" % FILTER
    print("SCRIPT_SUCCESS: " + output)
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("get_compile_messages",
        "Returns compilation errors, warnings and info messages from the CODESYS message center. Call after compile_project.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            filter: zod_1.z.enum(["all", "error", "warning", "info"]).default("all").describe("Filter by severity: all / error / warning / info")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, filter = "all" } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: get_compile_messages filter=${filter} path=${absPath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = GET_COMPILE_MESSAGES_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", escapedPath)
                    .replace("{FILTER}", filter);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed: ${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        // --- get_codesys_log tool ---
        server.tool("get_codesys_log",
        "Reads CODESYS runtime log files from disk (Control Win V3 service log and PLC log). Useful for runtime errors.",
        {
            logType: zod_1.z.enum(["runtime", "plc", "all"]).default("all").describe("Which log to read: runtime (service log), plc (PlcLog.csv), all"),
            lines: zod_1.z.coerce.number().default(50).describe("Number of last lines to return (default 50)")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { logType = "all", lines = 50 } = args;
            console.error(`Tool call: get_codesys_log type=${logType} lines=${lines}`);
            const fs = require('fs');
            const results = [];
            const runtimeLog = "C:\\ProgramData\\CODESYS\\CODESYSControlWinV3\\FA001425\\CODESYS Control Win V3.log";
            const plcLog    = "C:\\ProgramData\\CODESYS\\CODESYSControlWinV3\\FA001425\\PlcLog.csv";
            function readLastLines(filePath, n) {
                try {
                    if (!fs.existsSync(filePath)) return `File not found: ${filePath}`;
                    const content = fs.readFileSync(filePath, 'utf8');
                    const allLines = content.split(/\r?\n/).filter(l => l.trim());
                    return allLines.slice(-n).join('\n');
                }
                catch (e) {
                    return `Error reading ${filePath}: ${e.message}`;
                }
            }
            if (logType === "runtime" || logType === "all") {
                results.push("=== CODESYS Control Win V3 Runtime Log ===");
                results.push(readLastLines(runtimeLog, lines));
            }
            if (logType === "plc" || logType === "all") {
                results.push("=== PLC Log (PlcLog.csv) ===");
                results.push(readLastLines(plcLog, lines));
            }
            const output = results.join('\n\n');
            return { content: [{ type: "text", text: output }], isError: false };
        }));
        // --- download_to_plc tool ---
        const DOWNLOAD_TO_PLC_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback, time
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
SIMULATION_MODE = {SIMULATION_MODE}
START_AFTER_DOWNLOAD = {START_AFTER_DOWNLOAD}
try:
    print("DEBUG: download_to_plc: project=%s sim=%s start=%s" % (PROJECT_FILE_PATH, SIMULATION_MODE, START_AFTER_DOWNLOAD))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)

    # 1. Find device and set simulation mode
    device = None
    try:
        all_children = primary_project.get_children(True)
        for child in all_children:
            if hasattr(child, 'get_simulation_mode'):
                device = child
                print("DEBUG: Found device: %s" % child.get_name())
                break
        if device:
            device.set_simulation_mode(SIMULATION_MODE)
            print("DEBUG: Simulation mode set to %s" % SIMULATION_MODE)
        else:
            print("WARN: No device found, skipping simulation mode setting")
    except Exception as dev_err:
        print("WARN: Could not set simulation mode: %s" % dev_err)

    # 2. Find application
    target_app = primary_project.active_application
    if not target_app:
        for child in primary_project.get_children(True):
            if hasattr(child, 'is_application') and child.is_application:
                target_app = child
                break
    if not target_app:
        raise RuntimeError("No application found in project")
    app_name = target_app.get_name()
    print("DEBUG: Application found: %s" % app_name)

    # 3. Build
    print("DEBUG: Building application...")
    target_app.build()
    time.sleep(2)

    # 4. Check build messages for errors
    errors = []
    try:
        for msg in script_engine.system.get_message_objects():
            sev = str(getattr(msg, 'severity', '')).lower()
            if 'error' in sev:
                errors.append(str(getattr(msg, 'description', str(msg))))
    except Exception as msg_err:
        print("WARN: Could not read messages: %s" % msg_err)
    if errors:
        raise RuntimeError("Build errors:\\n" + "\\n".join(errors[:10]))
    print("DEBUG: Build OK, no errors")

    # 5. Login + Download
    print("DEBUG: Starting online login and download...")
    online_app = script_engine.online.create_online_application(target_app)
    try:
        online_app.login(script_engine.OnlineChangeOption.Never, True)
        print("DEBUG: Login/download complete")
        time.sleep(2)

        # 6. Start if requested
        if START_AFTER_DOWNLOAD:
            print("DEBUG: Starting application...")
            online_app.start()
            time.sleep(1)
            print("DEBUG: Application started")

        state = str(getattr(online_app, 'application_state', 'unknown'))
        print("SCRIPT_SUCCESS: Download complete. App=%s State=%s Sim=%s" % (app_name, state, SIMULATION_MODE))
        sys.exit(0)
    finally:
        try:
            online_app.logout()
            print("DEBUG: Logged out")
        except:
            pass

except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("download_to_plc",
        "Builds and downloads CODESYS application to PLC or emulator. Optionally starts the application after download.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            simulationMode: zod_1.z.coerce.boolean().default(false).describe("Enable simulation/emulation mode (default: false = Control Win V3). Set true for built-in CODESYS IDE simulator."),
            startAfterDownload: zod_1.z.coerce.boolean().default(true).describe("Start the application after download (default: true).")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, simulationMode = true, startAfterDownload = true } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: download_to_plc sim=${simulationMode} start=${startAfterDownload} path=${absPath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = DOWNLOAD_TO_PLC_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", escapedPath)
                    .replace("{SIMULATION_MODE}", simulationMode ? "True" : "False")
                    .replace("{START_AFTER_DOWNLOAD}", startAfterDownload ? "True" : "False");
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        // --- monitor_variable tool ---
        const MONITOR_VARIABLE_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback, time
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
ACTION        = "{ACTION}"
VARIABLE_PATH = "{VARIABLE_PATH}"
WRITE_VALUE   = "{WRITE_VALUE}"
try:
    print("DEBUG: monitor_variable action=%s var=%s" % (ACTION, VARIABLE_PATH))
    primary_project = ensure_project_open(PROJECT_FILE_PATH)

    # Find application
    target_app = primary_project.active_application
    if not target_app:
        for child in primary_project.get_children(True):
            if hasattr(child, 'is_application') and child.is_application:
                target_app = child
                break
    if not target_app:
        raise RuntimeError("No application found in project")

    # Connect online (read-only login - no download)
    online_app = script_engine.online.create_online_application(target_app)
    try:
        online_app.login(script_engine.OnlineChangeOption.Never, False)
        print("DEBUG: Online login OK")
        time.sleep(0.5)

        # Detect available variable API (SP17 vs SP21+)
        has_create_variable = hasattr(online_app, 'create_variable')
        has_read_value      = hasattr(online_app, 'read_value')
        has_prepare_value   = hasattr(online_app, 'prepare_value')
        print("DEBUG: API: create_variable=%s read_value=%s prepare_value=%s" % (
            has_create_variable, has_read_value, has_prepare_value))

        def read_var(path):
            if has_create_variable:
                v = online_app.create_variable(path)
                online_app.read_variables([v])
                return v.value
            elif has_read_value:
                return online_app.read_value(path)
            elif has_prepare_value:
                online_app.prepare_value(path, None)
                return online_app.read_value(path)
            else:
                # SP17 fallback: list all available attrs for diagnostics
                attrs = [a for a in dir(online_app) if not a.startswith('_')]
                raise RuntimeError("No variable read API found. OnlineApp attrs: %s" % attrs)

        def write_var(path, raw_val):
            if has_create_variable:
                # SP21+: convert to Python types for create_variable API
                write_val = raw_val
                try:
                    if str(raw_val).upper() == "TRUE":  write_val = True
                    elif str(raw_val).upper() == "FALSE": write_val = False
                    elif "." in str(raw_val):             write_val = float(raw_val)
                    else:                                  write_val = int(raw_val)
                except: pass
                v = online_app.create_variable(path)
                v.value = write_val
                online_app.write_variables([v])
                online_app.read_variables([v])
                return v.value
            else:
                # SP17: set_prepared_value expects STRING, not Python bool/int
                try:
                    online_app.set_prepared_value(path, str(raw_val))
                    try:
                        online_app.write_prepared_values()
                    except Exception:
                        online_app.force_prepared_values()
                    time.sleep(0.2)
                    return online_app.read_value(path)
                except Exception as write_err:
                    attrs = [a for a in dir(online_app) if not a.startswith('_')]
                    raise RuntimeError("Write failed: %s\\nOnlineApp attrs: %s" % (write_err, attrs))

        if ACTION == "read":
            value = read_var(VARIABLE_PATH)
            print("SCRIPT_SUCCESS: %s = %s" % (VARIABLE_PATH, value))

        elif ACTION == "write":
            readback = write_var(VARIABLE_PATH, WRITE_VALUE)
            print("SCRIPT_SUCCESS: %s written=%s readback=%s" % (VARIABLE_PATH, WRITE_VALUE, readback))

        elif ACTION == "read_all":
            paths = [p.strip() for p in VARIABLE_PATH.split(";") if p.strip()]
            lines = []
            for p in paths:
                try:
                    lines.append("%s = %s" % (p, read_var(p)))
                except Exception as re:
                    lines.append("%s = ERROR: %s" % (p, re))
            print("SCRIPT_SUCCESS:\\n" + "\\n".join(lines))

        else:
            raise RuntimeError("Unknown action: %s. Use read/write/read_all" % ACTION)

    finally:
        try:
            online_app.logout()
            print("DEBUG: Logged out")
        except:
            pass

    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("monitor_variable",
        "Read or write variables from a running CODESYS application (online). App must be running (use download_to_plc first). Actions: read, write, read_all (semicolon-separated paths).",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            action: zod_1.z.enum(["read", "write", "read_all"]).describe("read — get value, write — set value, read_all — read multiple vars (semicolon-separated paths)"),
            variablePath: zod_1.z.string().describe("Variable path, e.g. '.Application.PLC_PRG.fbSchyotchik.nCount'. For read_all — semicolon-separated list."),
            value: zod_1.z.string().optional().describe("Value to write (for action=write). Supports: TRUE/FALSE, integers, floats.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, action, variablePath, value = "" } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: monitor_variable action=${action} var=${variablePath}`);
            try {
                const escapedPath = absPath.replace(/\\/g, '\\\\');
                const script = MONITOR_VARIABLE_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", escapedPath)
                    .replace("{ACTION}", action)
                    .replace("{VARIABLE_PATH}", variablePath)
                    .replace("{WRITE_VALUE}", value);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));
        // ═══════════════════════════════════════════════════════════════════
        // CUSTOM EXTENSIONS — T-MCP-08..14
        // ═══════════════════════════════════════════════════════════════════

        // --- T-MCP-08: read_pou_code ---
        const READ_POU_CODE_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
POU_FULL_PATH = "{POU_FULL_PATH}"
def find_child(parent, name):
    try:
        for child in parent.get_children(False):
            try:
                if child.get_name() == name:
                    return child
            except Exception:
                pass
    except Exception:
        pass
    return None
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    parts = POU_FULL_PATH.strip("/").split("/")
    # If path starts with "Application", resolve it via active_application or recursive find
    if parts and parts[0].lower() == "application":
        obj = None
        try: obj = primary_project.active_application
        except Exception: pass
        if obj is None:
            try:
                found_list = primary_project.find("Application", True)
                if found_list: obj = found_list[0]
            except Exception: pass
        if obj is None:
            raise RuntimeError("Could not resolve Application in project")
        parts = parts[1:]
    else:
        obj = primary_project
    for part in parts:
        found = find_child(obj, part)
        if found is None:
            # fallback: recursive search from current node
            try:
                found_list = obj.find(part, True)
                if found_list: found = found_list[0]
            except Exception:
                pass
        if found is None:
            raise RuntimeError("Object not found: '%s' in path '%s'" % (part, POU_FULL_PATH))
        obj = found
    decl = ""
    impl = ""
    try:
        td = obj.get_textual_declaration()
        if td: decl = td.text
    except Exception as e:
        decl = "(declaration not available: %s)" % e
    try:
        ti = obj.get_textual_implementation()
        if ti: impl = ti.text
    except Exception as e:
        impl = "(implementation not available: %s)" % e
    output = "=== DECLARATION ===\\n%s\\n\\n=== IMPLEMENTATION ===\\n%s" % (decl, impl)
    print("SCRIPT_SUCCESS: " + output)
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("read_pou_code",
        "Read the current ST declaration and implementation code of a specific POU, Method, or Property. Use pouPath like 'Application/FB_Counter'.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            pouPath: zod_1.z.string().describe("Full path to POU/Method/Property, e.g. 'Application/FB_Counter' or 'Application/FB_Counter/Reset'.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, pouPath } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            const sanPouPath = pouPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
            console.error(`Tool call: read_pou_code path=${sanPouPath}`);
            try {
                const script = READ_POU_CODE_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", absPath.replace(/\\/g, '\\\\'))
                    .replace("{POU_FULL_PATH}", sanPouPath);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));

        // --- T-MCP-09: get_application_state ---
        const GET_APP_STATE_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback, time
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    target_app = primary_project.active_application
    if not target_app:
        for child in primary_project.get_children(True):
            if hasattr(child, 'is_application') and child.is_application:
                target_app = child
                break
    if not target_app:
        print("SCRIPT_SUCCESS: state=NoApplication")
        sys.exit(0)
    app_name = target_app.get_name()
    online_app = script_engine.online.create_online_application(target_app)
    try:
        online_app.login(script_engine.OnlineChangeOption.Never, False)
        time.sleep(0.3)
        state_raw = str(getattr(online_app, 'application_state', 'Unknown'))
        # Normalize common state strings
        s = state_raw.lower()
        if 'run' in s:   state = 'Running'
        elif 'stop' in s: state = 'Stopped'
        elif 'exception' in s or 'error' in s: state = 'Error'
        elif 'no' in s and 'app' in s: state = 'NoApplication'
        else: state = state_raw
        print("SCRIPT_SUCCESS: state=%s app=%s raw=%s" % (state, app_name, state_raw))
        sys.exit(0)
    finally:
        try: online_app.logout()
        except: pass
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("get_application_state",
        "Get the current runtime state of the CODESYS application (Running/Stopped/Error/NoApplication). Does not modify the application.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: get_application_state path=${absPath}`);
            try {
                const script = GET_APP_STATE_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", absPath.replace(/\\/g, '\\\\'));
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));

        // --- T-MCP-10: update_symbol_configuration ---
        const UPDATE_SYMCONFIG_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback, re
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
VARIABLES_CSV = """{VARIABLES_CSV}"""
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    # Find Application
    target_app = None
    try: target_app = primary_project.active_application
    except Exception: pass
    if target_app is None:
        try:
            lst = primary_project.find("Application", True)
            if lst: target_app = lst[0]
        except Exception: pass
    if not target_app:
        raise RuntimeError("No application found in project")
    # Find SymbolConfiguration (named 'Symbols' in project tree)
    sym_cfg = None
    for child in target_app.get_children(False):
        try:
            name_str = child.get_name().lower()
            type_str = str(type(child)).lower()
            if 'symbol' in name_str or 'symbol' in type_str:
                sym_cfg = child
                print("DEBUG: Found sym_cfg: name=%s type=%s" % (child.get_name(), type(child)))
                break
        except Exception: pass
    if sym_cfg is None:
        raise RuntimeError("SymbolConfiguration not found. Add 'Символьная конфигурация' in CODESYS UI first.")
    # Parse variable paths to add
    var_paths = [v.strip() for v in VARIABLES_CSV.split(",") if v.strip()]
    print("DEBUG: vars to add: %s" % var_paths)
    # Read current XML via textual_declaration
    xml_text = ""
    td = None
    try:
        td = sym_cfg.get_textual_declaration()
        if td: xml_text = td.text or ""
    except Exception as e:
        print("WARN: get_textual_declaration failed: %s" % e)
    print("DEBUG: current XML length=%d" % len(xml_text))
    print("DEBUG: XML preview: %s" % xml_text[:500])
    added = []
    skipped = []
    if td and xml_text.strip():
        # XML-based approach: add entries via regex/string manipulation
        for vpath in var_paths:
            # Check if already present (case-insensitive match on variable path)
            if vpath.lower() in xml_text.lower():
                skipped.append(vpath + " (already exists)")
                print("DEBUG: already exists: %s" % vpath)
                continue
            # Build new entry element — try common CODESYS symbol config XML formats
            # Format 1: <Entry Variable=".App.PLC_PRG.bVar" ... />
            new_entry = '        <Entry Variable="%s" />' % vpath
            # Insert before </Entries> or </SymbolConfiguration>
            if '</Entries>' in xml_text:
                xml_text = xml_text.replace('</Entries>', new_entry + '\\n        </Entries>')
                added.append(vpath)
            elif '</SymbolConfiguration>' in xml_text:
                xml_text = xml_text.replace('</SymbolConfiguration>', '    <Entries>\\n' + new_entry + '\\n    </Entries>\\n</SymbolConfiguration>')
                added.append(vpath)
            else:
                # Append as comment to signal manual action needed
                skipped.append(vpath + " (XML format unknown, see DEBUG)")
                print("DEBUG: unknown XML format, cannot add: %s" % vpath)
        if added:
            try:
                td.replace(xml_text)
                print("DEBUG: XML written back successfully")
            except Exception as write_err:
                raise RuntimeError("Failed to write Symbol Configuration XML: %s" % write_err)
    else:
        # No XML text — try object API as fallback
        print("DEBUG: No XML text, trying object API. sym_cfg attrs: %s" % [a for a in dir(sym_cfg) if not a.startswith('_')])
        for vpath in var_paths:
            # Try various SP17 methods
            for method_name in ['add_symbol', 'add_entry', 'insert_symbol', 'create_symbol']:
                method = getattr(sym_cfg, method_name, None)
                if method:
                    try:
                        method(vpath)
                        added.append(vpath)
                        print("DEBUG: Added via %s: %s" % (method_name, vpath))
                        break
                    except Exception as me:
                        print("DEBUG: %s failed: %s" % (method_name, me))
            else:
                skipped.append(vpath + " (no working API found)")
    primary_project.save()
    print("SCRIPT_SUCCESS: added=%s skipped=%s" % (added, skipped))
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("update_symbol_configuration",
        "Add variables to CODESYS Symbol Configuration (OPC UA export) without opening the UI. Pass comma-separated variable paths like '.Application.PLC_PRG.bMyVar'.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            variablePaths: zod_1.z.string().describe("Comma-separated list of variable paths to add to Symbol Configuration, e.g. '.Application.PLC_PRG.bMyVar,.Application.PLC_PRG.nMyInt'.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, variablePaths } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: update_symbol_configuration vars=${variablePaths}`);
            try {
                const script = UPDATE_SYMCONFIG_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", absPath.replace(/\\/g, '\\\\'))
                    .replace("{VARIABLES_CSV}", variablePaths);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));

        // --- T-MCP-11: create_gvl ---
        const CREATE_GVL_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
GVL_NAME    = "{GVL_NAME}"
PARENT_PATH = "{PARENT_PATH}"
GVL_CODE    = """{GVL_CODE}"""
def resolve_parent(project, path_str):
    parts = path_str.strip("/").split("/") if path_str else []
    parent = project
    if parts and parts[0].lower() == "application":
        try: parent = project.active_application
        except Exception: pass
        if parent is None:
            try:
                lst = project.find("Application", True)
                if lst: parent = lst[0]
            except Exception: pass
        parts = parts[1:]
    for part in parts:
        found = None
        for child in parent.get_children(False):
            try:
                if child.get_name() == part:
                    found = child
                    break
            except: pass
        if not found:
            raise RuntimeError("Parent not found: '%s'" % part)
        parent = found
    return parent
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    parent = resolve_parent(primary_project, PARENT_PATH)
    # Create GVL
    gvl = parent.create_object(scriptengine.ScriptGlobalVariableList, GVL_NAME)
    if not gvl:
        raise RuntimeError("Failed to create GVL '%s'" % GVL_NAME)
    # Set code if provided
    if GVL_CODE.strip():
        try:
            td = gvl.get_textual_declaration()
            if td:
                td.replace(GVL_CODE)
        except Exception as ce:
            print("WARN: Could not set GVL code: %s" % ce)
    primary_project.save()
    print("SCRIPT_SUCCESS: GVL '%s' created in '%s'" % (GVL_NAME, PARENT_PATH))
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("create_gvl",
        "Create a Global Variable List (GVL) in a CODESYS project. Optionally set the initial VAR_GLOBAL code.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            name: zod_1.z.string().describe("GVL name, e.g. 'GVL_HMI'."),
            parentPath: zod_1.z.string().default("Application").describe("Parent path, e.g. 'Application'. Default: Application."),
            code: zod_1.z.string().optional().describe("Initial VAR_GLOBAL...END_VAR declaration code.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, name, parentPath = "Application", code = "" } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: create_gvl name=${name} parent=${parentPath}`);
            try {
                const script = CREATE_GVL_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", absPath.replace(/\\/g, '\\\\'))
                    .replace("{GVL_NAME}", name)
                    .replace("{PARENT_PATH}", parentPath)
                    .replace("{GVL_CODE}", code.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"'));
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));

        // --- T-MCP-12: create_dut ---
        const CREATE_DUT_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
DUT_NAME    = "{DUT_NAME}"
DUT_TYPE    = "{DUT_TYPE}"
PARENT_PATH = "{PARENT_PATH}"
DUT_BODY    = """{DUT_BODY}"""
def resolve_parent(project, path_str):
    parts = path_str.strip("/").split("/") if path_str else []
    parent = project
    if parts and parts[0].lower() == "application":
        try: parent = project.active_application
        except Exception: pass
        if parent is None:
            try:
                lst = project.find("Application", True)
                if lst: parent = lst[0]
            except Exception: pass
        parts = parts[1:]
    for part in parts:
        found = None
        for child in parent.get_children(False):
            try:
                if child.get_name() == part:
                    found = child
                    break
            except: pass
        if not found:
            raise RuntimeError("Parent not found: '%s'" % part)
        parent = found
    return parent
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    parent = resolve_parent(primary_project, PARENT_PATH)
    # Map DUT type string to scriptengine type
    type_map = {
        "STRUCT": scriptengine.ScriptDut,
        "ENUM":   scriptengine.ScriptDut,
        "UNION":  scriptengine.ScriptDut,
    }
    dut_script_type = type_map.get(DUT_TYPE.upper(), scriptengine.ScriptDut)
    dut = parent.create_object(dut_script_type, DUT_NAME)
    if not dut:
        raise RuntimeError("Failed to create DUT '%s'" % DUT_NAME)
    # Build full DUT code with wrapper
    wrappers = {
        "STRUCT": ("TYPE %s :\\nSTRUCT\\n" % DUT_NAME, "END_STRUCT\\nEND_TYPE"),
        "ENUM":   ("TYPE %s :\\n(" % DUT_NAME, ");\\nEND_TYPE"),
        "UNION":  ("TYPE %s :\\nUNION\\n" % DUT_NAME, "END_UNION\\nEND_TYPE"),
    }
    if DUT_BODY.strip():
        prefix, suffix = wrappers.get(DUT_TYPE.upper(), ("TYPE %s :\\n" % DUT_NAME, "\\nEND_TYPE"))
        full_code = prefix + DUT_BODY + "\\n" + suffix
        try:
            td = dut.get_textual_declaration()
            if td:
                td.replace(full_code)
        except Exception as ce:
            print("WARN: Could not set DUT code: %s" % ce)
    primary_project.save()
    print("SCRIPT_SUCCESS: DUT '%s' (%s) created in '%s'" % (DUT_NAME, DUT_TYPE, PARENT_PATH))
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("create_dut",
        "Create a Data Unit Type (STRUCT, ENUM, or UNION) in a CODESYS project.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            name: zod_1.z.string().describe("DUT name, e.g. 'E_MotorState' or 'ST_MotorParams'."),
            dutType: zod_1.z.enum(["STRUCT", "ENUM", "UNION"]).describe("Type: STRUCT, ENUM, or UNION."),
            parentPath: zod_1.z.string().default("Application").describe("Parent path, e.g. 'Application'. Default: Application."),
            body: zod_1.z.string().optional().describe("DUT body (without TYPE wrapper), e.g. for ENUM: '(Idle := 0, Running := 1, Error := 2)'. For STRUCT: field declarations.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, name, dutType, parentPath = "Application", body = "" } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: create_dut name=${name} type=${dutType} parent=${parentPath}`);
            try {
                const script = CREATE_DUT_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", absPath.replace(/\\/g, '\\\\'))
                    .replace("{DUT_NAME}", name)
                    .replace("{DUT_TYPE}", dutType)
                    .replace("{PARENT_PATH}", parentPath)
                    .replace("{DUT_BODY}", body.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"'));
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));

        // --- T-MCP-13: list_project_objects ---
        const LIST_PROJECT_OBJECTS_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
def describe(obj, depth=0):
    lines = []
    try:
        name = obj.get_name()
    except:
        name = str(obj)
    type_str = type(obj).__name__
    indent = "  " * depth
    lines.append("%s[%s] %s" % (indent, type_str, name))
    try:
        for child in obj.get_children(False):
            lines.extend(describe(child, depth + 1))
    except:
        pass
    return lines
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    lines = describe(primary_project, 0)
    output = "\\n".join(lines)
    print("SCRIPT_SUCCESS:\\n" + output)
    sys.exit(0)
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("list_project_objects",
        "List all objects in a CODESYS project as an indented tree (POUs, GVLs, DUTs, folders, tasks, etc.) with their types.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: list_project_objects path=${absPath}`);
            try {
                const script = LIST_PROJECT_OBJECTS_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", absPath.replace(/\\/g, '\\\\'));
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));

        // --- T-MCP-14: start_stop_application ---
        const START_STOP_APP_SCRIPT_TEMPLATE = `
import sys, scriptengine as script_engine, os, traceback, time
${ENSURE_PROJECT_OPEN_PYTHON_SNIPPET}
ACTION = "{ACTION}"
try:
    primary_project = ensure_project_open(PROJECT_FILE_PATH)
    target_app = primary_project.active_application
    if not target_app:
        for child in primary_project.get_children(True):
            if hasattr(child, 'is_application') and child.is_application:
                target_app = child
                break
    if not target_app:
        raise RuntimeError("No application found in project")
    app_name = target_app.get_name()
    online_app = script_engine.online.create_online_application(target_app)
    try:
        online_app.login(script_engine.OnlineChangeOption.Never, False)
        time.sleep(0.3)
        if ACTION == "start":
            online_app.start()
            time.sleep(0.5)
            print("SCRIPT_SUCCESS: Application '%s' started" % app_name)
        elif ACTION == "stop":
            online_app.stop()
            time.sleep(0.5)
            print("SCRIPT_SUCCESS: Application '%s' stopped" % app_name)
        elif ACTION == "reset":
            online_app.reset()
            time.sleep(0.5)
            print("SCRIPT_SUCCESS: Application '%s' reset" % app_name)
        else:
            raise RuntimeError("Unknown action: '%s'. Use start/stop/reset" % ACTION)
        sys.exit(0)
    finally:
        try: online_app.logout()
        except: pass
except Exception as e:
    print("SCRIPT_ERROR: %s" % traceback.format_exc())
    sys.exit(1)
`;
        server.tool("start_stop_application",
        "Start, stop, or reset a running CODESYS application without re-downloading. The application must already be loaded on the PLC/runtime.",
        {
            projectFilePath: zod_1.z.string().describe("Path to the .project file."),
            action: zod_1.z.enum(["start", "stop", "reset"]).describe("Action: start — run application, stop — halt execution, reset — reset to initial state.")
        }, (args) => __awaiter(this, void 0, void 0, function* () {
            const { projectFilePath, action } = args;
            const absPath = path.normalize(path.isAbsolute(projectFilePath) ? projectFilePath : path.join(WORKSPACE_DIR, projectFilePath));
            console.error(`Tool call: start_stop_application action=${action} path=${absPath}`);
            try {
                const script = START_STOP_APP_SCRIPT_TEMPLATE
                    .replace("{PROJECT_FILE_PATH}", absPath.replace(/\\/g, '\\\\'))
                    .replace("{ACTION}", action);
                const result = yield (0, codesys_interop_1.executeCodesysScript)(script, codesysExePath, codesysProfileName);
                const success = result.success && result.output.includes("SCRIPT_SUCCESS");
                const msg = success ? result.output.split("SCRIPT_SUCCESS:")[1].trim() : `Failed:\n${result.output}`;
                return { content: [{ type: "text", text: msg }], isError: !success };
            }
            catch (e) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }));

        // ═══════════════════════════════════════════════════════════════════
        // END CUSTOM EXTENSIONS
        // ═══════════════════════════════════════════════════════════════════

        // --- End Tools ---
        console.error("SERVER.TS: Resources and Tools defined.");
        // --- End MCP Resources / Tools Definitions ---
        // --- Server Connection ---
        console.error("SERVER.TS: startServer() internal logic executing.");
        try {
            const transport = new stdio_js_1.StdioServerTransport();
            console.error("SERVER.TS: Connecting MCP server via stdio...");
            // No need to await connect here if startMcpServer is called by bin.ts which awaits it
            // await server.connect(transport);
            server.connect(transport); // Connect but don't await here, let bin.ts handle waiting
            console.error("SERVER.TS: MCP Server connection initiated via stdio.");
            // console.error("SERVER.TS: server.connect() promise resolved successfully."); // This log might be premature now
        }
        catch (error) {
            console.error("FATAL: Failed to initiate MCP server connection:", error);
            // Re-throw error so bin.ts can catch it
            throw error;
            // process.exit(1);
        }
        // --- End Server Connection ---
    });
} // --- End of startMcpServer function ---
// --- Graceful Shutdown / Unhandled Rejection ---
// These should remain at the top level, outside startMcpServer
process.on('SIGINT', () => {
    console.error('\nSERVER.TS: SIGINT received, shutting down...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.error('\nSERVER.TS: SIGTERM received, shutting down...');
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('SERVER.TS: Unhandled Rejection at:', promise, 'reason:', reason);
});
// --- End Graceful Shutdown / Unhandled Rejection ---
console.error(">>> SERVER.TS Module Parsed <<<"); // Log end of script parsing
