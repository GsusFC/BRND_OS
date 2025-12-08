"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, Search, Trash2, Rocket, Check, AlertTriangle, Info, Copy, ExternalLink } from "lucide-react"

export default function DesignSystemPage() {
    return (
        <div className="space-y-12">
            <div>
                <h1 className="text-4xl font-black text-white font-display uppercase">
                    Design System
                </h1>
                <p className="text-zinc-500 mt-1 font-mono text-sm">
                    BRND OS Component Library (shadcn/ui)
                </p>
            </div>

            {/* Buttons */}
            <Card>
                <CardTitle>Buttons</CardTitle>
                <CardContent className="space-y-6">
                    {/* Variants */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Variants</p>
                        <div className="flex flex-wrap gap-3">
                            <Button>Default (Glass)</Button>
                            <Button variant="secondary">Secondary (Solid)</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Button variant="destructive">Destructive</Button>
                            <Button variant="brand">
                                <span className="relative z-10">Brand</span>
                            </Button>
                            <Button variant="brand-light">Brand Light</Button>
                            <Button variant="link">Link</Button>
                        </div>
                    </div>

                    {/* Brand Colors */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Brand Colors</p>
                        <div className="flex flex-wrap gap-3">
                            <Button variant="green">Green</Button>
                            <Button variant="yellow">Yellow</Button>
                            <Button variant="red">Red</Button>
                            <Button variant="blue">Blue</Button>
                        </div>
                    </div>

                    {/* Sizes */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Sizes</p>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="sm">Small</Button>
                            <Button>Medium (Default)</Button>
                            <Button size="lg">Large</Button>
                        </div>
                    </div>

                    {/* With Icons */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">With Icons</p>
                        <div className="flex flex-wrap gap-3">
                            <Button><Plus className="w-4 h-4" /> Add Item</Button>
                            <Button variant="secondary"><Search className="w-4 h-4" /> Search</Button>
                            <Button variant="destructive"><Trash2 className="w-4 h-4" /> Delete</Button>
                            <Button variant="brand">
                                <span className="relative z-10 flex items-center gap-2">
                                    <Rocket className="w-4 h-4" /> Launch
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* Icon Only */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Icon Only</p>
                        <div className="flex flex-wrap gap-3">
                            <Button size="icon-sm"><Plus className="w-4 h-4" /></Button>
                            <Button size="icon"><Search className="w-5 h-5" /></Button>
                            <Button size="icon-lg"><Rocket className="w-6 h-6" /></Button>
                        </div>
                    </div>

                    {/* States */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">States</p>
                        <div className="flex flex-wrap gap-3">
                            <Button disabled>Disabled</Button>
                            <Button variant="secondary" disabled>Disabled</Button>
                        </div>
                    </div>

                    {/* Full Width */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Full Width</p>
                        <Button className="w-full"><Plus className="w-4 h-4" /> Full Width Button</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Inputs */}
            <Card>
                <CardTitle>Inputs</CardTitle>
                <CardContent className="space-y-6">
                    {/* Default */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Default</p>
                        <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="Enter text..." />
                            <Input type="email" placeholder="email@example.com" />
                        </div>
                    </div>

                    {/* States */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">States</p>
                        <div className="grid grid-cols-3 gap-4">
                            <Input placeholder="Default" />
                            <Input aria-invalid="true" placeholder="With error" />
                            <Input disabled placeholder="Disabled" />
                        </div>
                    </div>

                    {/* Types */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Input Types</p>
                        <div className="grid grid-cols-2 gap-4">
                            <Input type="number" placeholder="Number" />
                            <Input type="password" placeholder="Password" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Badges */}
            <Card>
                <CardTitle>Badges</CardTitle>
                <CardContent className="space-y-6">
                    {/* Variants */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Variants</p>
                        <div className="flex flex-wrap gap-3">
                            <Badge>Default</Badge>
                            <Badge variant="success">Success</Badge>
                            <Badge variant="warning">Warning</Badge>
                            <Badge variant="destructive">Error</Badge>
                            <Badge variant="info">Info</Badge>
                            <Badge variant="brand">Brand</Badge>
                            <Badge variant="outline">Outline</Badge>
                        </div>
                    </div>

                    {/* With Icons */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">With Icons</p>
                        <div className="flex flex-wrap gap-3">
                            <Badge variant="success"><Check className="w-3 h-3" /> Verified</Badge>
                            <Badge variant="warning"><AlertTriangle className="w-3 h-3" /> Warning</Badge>
                            <Badge variant="info"><Info className="w-3 h-3" /> Info</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardTitle>Table</CardTitle>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Label</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="font-mono">0x1234...5678</TableCell>
                                <TableCell className="text-zinc-400">Main Wallet</TableCell>
                                <TableCell><Badge variant="success">Active</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button size="icon-sm" variant="ghost"><Copy className="w-4 h-4" /></Button>
                                    <Button size="icon-sm" variant="ghost"><ExternalLink className="w-4 h-4" /></Button>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-mono">0xabcd...efgh</TableCell>
                                <TableCell className="text-zinc-400">Trading</TableCell>
                                <TableCell><Badge variant="warning">Pending</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button size="icon-sm" variant="ghost"><Copy className="w-4 h-4" /></Button>
                                    <Button size="icon-sm" variant="ghost"><ExternalLink className="w-4 h-4" /></Button>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Card>
                <CardTitle>Tabs</CardTitle>
                <CardContent>
                    <Tabs defaultValue="overview">
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                            <TabsTrigger value="settings">Settings</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview" className="mt-4">
                            <p className="text-zinc-400 text-sm">Overview content goes here.</p>
                        </TabsContent>
                        <TabsContent value="analytics" className="mt-4">
                            <p className="text-zinc-400 text-sm">Analytics content goes here.</p>
                        </TabsContent>
                        <TabsContent value="settings" className="mt-4">
                            <p className="text-zinc-400 text-sm">Settings content goes here.</p>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Cards */}
            <Card>
                <CardTitle>Cards</CardTitle>
                <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                        <Card>
                            <CardTitle>Default Card</CardTitle>
                            <CardContent>
                                <p className="text-sm text-zinc-400">Standard card with border and background.</p>
                            </CardContent>
                        </Card>

                        <Card className="hover:border-zinc-600 transition-colors cursor-pointer">
                            <CardTitle>Hover Card</CardTitle>
                            <CardContent>
                                <p className="text-sm text-zinc-400">Card with hover effect. Try hovering!</p>
                            </CardContent>
                        </Card>

                        <Card variant="gradient" className="cursor-pointer">
                            <CardTitle>Gradient Card</CardTitle>
                            <CardContent>
                                <p className="text-sm text-zinc-400">Card with animated gradient border on hover!</p>
                            </CardContent>
                        </Card>

                        <Card variant="gradient" className="cursor-pointer">
                            <CardTitle>Another Gradient</CardTitle>
                            <CardContent>
                                <p className="text-sm text-zinc-400">The gradient spins when you hover.</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Horizontal Cards */}
                    <div className="mt-6">
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Horizontal Variant</p>
                        <div className="space-y-2">
                            <Card variant="horizontal" className="cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800" />
                                    <span className="text-sm font-medium">Item Title</span>
                                </div>
                                <span className="text-xs text-zinc-500">Meta info</span>
                            </Card>
                            <Card variant="horizontal" className="cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800" />
                                    <span className="text-sm font-medium">Another Item</span>
                                </div>
                                <span className="text-xs text-zinc-500">Details</span>
                            </Card>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Color Palette */}
            <Card>
                <CardTitle>BRND Color Palette</CardTitle>
                <CardContent className="space-y-6">
                    {/* Brand Gradient */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Brand Gradient</p>
                        <div 
                            className="h-12 rounded-lg w-full"
                            style={{ background: "linear-gradient(90deg, #FFF100 0%, #FF0000 33%, #0C00FF 66%, #00FF00 100%)" }}
                        />
                    </div>

                    {/* Brand Gradient Light */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Brand Gradient Light (Headlines)</p>
                        <div 
                            className="h-12 rounded-lg w-full"
                            style={{ 
                                background: "linear-gradient(360deg, #FFFFFF 0%, rgba(255, 255, 255, 0.7) 50%, #FFFFFF 100%), linear-gradient(191.75deg, #FFF000 0%, #FF0000 33%, #0E00FF 66%, #00FF00 100%)" 
                            }}
                        />
                        <p className="text-4xl font-display font-black uppercase mt-4">
                            Sample Headline
                        </p>
                    </div>

                    {/* Brand Colors */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Brand Colors</p>
                        <div className="flex gap-3">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-[#FFF100]" />
                                <span className="text-xs font-mono text-zinc-500">#FFF100</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-[#FF0000]" />
                                <span className="text-xs font-mono text-zinc-500">#FF0000</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-[#0C00FF]" />
                                <span className="text-xs font-mono text-zinc-500">#0C00FF</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-[#00FF00]" />
                                <span className="text-xs font-mono text-zinc-500">#00FF00</span>
                            </div>
                        </div>
                    </div>

                    {/* UI Colors */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">UI Colors</p>
                        <div className="flex gap-3">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-black border border-zinc-700" />
                                <span className="text-xs font-mono text-zinc-500">Black</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-[#212020] border border-zinc-700" />
                                <span className="text-xs font-mono text-zinc-500">#212020</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-zinc-800" />
                                <span className="text-xs font-mono text-zinc-500">zinc-800</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-white" />
                                <span className="text-xs font-mono text-zinc-500">White</span>
                            </div>
                        </div>
                    </div>

                    {/* Borders */}
                    <div>
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3">Borders</p>
                        <div className="flex gap-3">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-[#484E55]" />
                                <span className="text-xs font-mono text-zinc-500">#484E55</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-14 h-14 rounded-lg bg-zinc-800" />
                                <span className="text-xs font-mono text-zinc-500">zinc-800</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
