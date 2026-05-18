import sys

with open('frontend/src/pages/CRM/Closers.tsx', 'r') as f:
    text = f.read()

# Locate the helper function end and the start of exported function
pattern_start = 'return (\n    <div className="min-w-[180px]'
pattern_end = 'export default function Closers()'

if pattern_start in text and pattern_end in text:
    parts = text.split(pattern_end)
    # Reconstruct the first part before Closers()
    before_closers = parts[0]
    
    # Let's find where the helper function should end
    # It starts around the return (
    helper_start_index = before_closers.find(pattern_start)
    if helper_start_index != -1:
        # We find the matching </div> for the outer div
        # In our case, we know it's the one followed by ); }
        div_end_marker = '    </div>\n  );\n}\n'
        
        # Search for the first occurrence of </div> after helper_start_index
        div_search_index = before_closers.find('    </div>', helper_start_index + 100)
        if div_search_index != -1:
             fixed_before = before_closers[:div_search_index] + div_end_marker
             # Now add Closers() back
             fixed_text = fixed_before + '\n' + pattern_end + parts[1]
             with open('frontend/src/pages/CRM/Closers.tsx', 'w') as f:
                 f.write(fixed_text)
             print("Fixed!")
        else:
             print("Could not find div end marker")
    else:
        print("Could not find pattern_start")
else:
    print("Could not find patterns")
