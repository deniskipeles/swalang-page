import os

def gather_files_to_single_txt(
    src_dir='src/routes/swalang',
    output_file='output.txt',
    skip_extensions=('.png', '.jpg', '.jpeg', '.gif', '.zip', '.exe', '.bin', '.md', '.sh', '.py','.txt'),
    skip_folders=('node_modules', 'testhelpers', '__pycache__', '.git', '.vscode', 'output.txt', 'build','tests'),
    skip_filenames=('README', 'test_helpers.go', 'LICENSE', 'CHANGELOG', '.gitignore', '.env','pylearn_interpreter','pylearn_repl'),  # New parameter
    enforce_unix_path=False
):
    """
    Recursively reads all files from src_dir and writes them into output_file.
    
    Args:
        src_dir: Root directory to scan
        output_file: Target output file
        skip_extensions: File extensions to skip
        skip_folders: Folders to skip
        skip_filenames: Specific filenames to skip (without extension)
        enforce_unix_path: Force Unix-style paths (/) even on Windows
    """
    with open(output_file, 'w', encoding='utf-8') as f_out:
        for dirpath, dirnames, filenames in os.walk(src_dir):
            
            # Remove skipped folders from os.walk's dirnames (in-place modification)
            dirnames[:] = [d for d in dirnames if d not in skip_folders]
            
            for filename in filenames:
                # Skip files with blacklisted extensions
                if any(filename.lower().endswith(ext) for ext in skip_extensions):
                    continue
                
                # Skip specific filenames (case-insensitive, without extension)
                file_base = os.path.splitext(filename)[0]
                if any(skip.lower() == file_base.lower() for skip in skip_filenames):
                    continue

                file_path = os.path.join(dirpath, filename)
                
                # Optional: Convert Windows paths to Unix style
                if enforce_unix_path:
                    file_path = file_path.replace('\\', '/')
                
                try:
                    # Try reading as text first
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f_in:
                        content = f_in.read()
                    
                    # Write to output with clear separation
                    f_out.write(f'\n\n\n// ==========================={file_path} start here===========================\n')
                    f_out.write(content)
                    f_out.write(f'\n// ==========================={file_path} ends here===========================\n')
                    
                    # Ensure separation even if file ends with newline
                    if not content.endswith('\n'):
                        f_out.write('\n')
                
                except UnicodeDecodeError:
                    # Handle binary files that slipped through
                    f_out.write(f'// BINARY FILE: {file_path} (not shown)\n\n')
                except Exception as e:
                    f_out.write(f'// ERROR: Could not read {file_path}: {str(e)}\n\n')

if __name__ == '__main__':
    gather_files_to_single_txt()