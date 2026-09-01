const fs = require('fs');
const file = 'src/app/(protected)/branch/users/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// The ternary started at 184: {loading ? (
// and 231: ) : (
// The table ends at 341: </table>
// and the div ends at 342: </div>
code = code.replace(
`                        </table>
                    </div>

                    {/* Status Filter */}`,
`                        </table>
                    </div>
                )}
            </div>

            {/* Controls Bar Extension (Recovered) */}
            <div className="bg-white border text-sm border-[#ecf0f6] shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="flex-1 flex justify-end gap-2">
                    {/* Status Filter */}`
);
fs.writeFileSync(file, code);
