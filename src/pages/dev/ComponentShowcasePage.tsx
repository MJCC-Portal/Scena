// Internal-only visual QA page for every Scena UI primitive in its main
// states. Not linked from any production nav. Verify this renders correctly
// before building any real page against these primitives (design contract
// gate — see docs/BUILD_PLAN.md-equivalent plan).
import { useState } from "react";
import {
  House, MagnifyingGlass, Plus, Trash, DotsThreeVertical, Rocket, ImageSquare,
} from "@phosphor-icons/react";
import { Button, IconButton, ButtonGroup } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Input, Textarea, SearchInput } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Checkbox, Radio, Switch } from "../../components/ui/Checkbox";
import { Card, GridCard, Grid } from "../../components/ui/Card";
import { Badge, StatusIndicator } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { Progress, Spinner } from "../../components/ui/Progress";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { Tooltip } from "../../components/ui/Tooltip";
import { DropdownMenu } from "../../components/ui/Menu";
import { Modal } from "../../components/ui/Modal";
import { Drawer } from "../../components/ui/Drawer";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Tabs, TabList, Tab, TabPanel } from "../../components/ui/Tabs";
import { Accordion } from "../../components/ui/Accordion";
import { DataTable } from "../../components/ui/DataTable";
import { useToast } from "../../components/ui/Toast";
import { PageHeader, SectionHeader } from "../../components/ui/PageHeader";
import { Breadcrumbs } from "../../components/ui/Breadcrumbs";
import { Pagination } from "../../components/ui/Pagination";
import { UploadDropzone, FileQueue } from "../../components/ui/UploadDropzone";
import { ScenaApiError } from "../../services/scena-api/errors";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <SectionHeader title={title} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>{children}</div>
    </section>
  );
}

export function ComponentShowcasePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [page, setPage] = useState(2);
  const toast = useToast();

  return (
    <div className="scena-page">
      <PageHeader title="Component showcase" description="Every Scena UI primitive, main states. Internal QA only." />

      <Section title="Breadcrumbs">
        <Breadcrumbs items={[{ label: "Home", to: "/dev/components" }, { label: "Boards", to: "/dev/components" }, { label: "Untitled Board" }]} />
      </Section>

      <Section title="Buttons">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="primary" loading>Loading</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" size="lg">Large</Button>
        <Button variant="primary" icon={<Rocket size={18} />}>With icon</Button>
        <IconButton icon={<Plus size={18} />} label="Add" />
        <IconButton icon={<Trash size={18} />} label="Delete" />
        <IconButton icon={<House size={18} />} label="Home" active />
        <ButtonGroup>
          <Button variant="secondary">Grid</Button>
          <Button variant="secondary">List</Button>
        </ButtonGroup>
      </Section>

      <Section title="Inputs">
        <Field label="Board name" hint="Shown in the library.">
          <Input placeholder="Untitled Board" style={{ width: 260 }} />
        </Field>
        <Field label="Description" error="Description is required.">
          <Textarea placeholder="What is this board for?" style={{ width: 260 }} error />
        </Field>
        <SearchInput placeholder="Search Boards and Assets" style={{ width: 260 }} />
        <Field label="Plan">
          <Select
            style={{ width: 200 }}
            options={[{ value: "plus", label: "Plus" }, { value: "pro", label: "Pro" }, { value: "max", label: "Max" }]}
          />
        </Field>
        <Checkbox label="Notify members" defaultChecked />
        <Radio label="Personal Workspace" name="wtype" defaultChecked />
        <Switch checked={switchOn} onChange={setSwitchOn} label="Auto-save" />
      </Section>

      <Section title="Cards">
        <Grid style={{ width: "100%" }}>
          <GridCard
            thumb={<ImageSquare size={28} />}
            title="Summer Menu Board"
            meta="1920 × 1080 · v4 · Updated 2h ago"
          />
          <Card interactive selected style={{ width: 220 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Selected card</div>
            <div style={{ fontSize: 13, color: "var(--scena-text-muted)" }}>Interactive + selected state</div>
          </Card>
        </Grid>
      </Section>

      <Section title="Badges & status">
        <Badge tone="success" dot>Ready</Badge>
        <Badge tone="warning" dot>Processing</Badge>
        <Badge tone="danger" dot>Failed</Badge>
        <Badge tone="violet" dot>Draft</Badge>
        <Badge tone="neutral" dot>Archived</Badge>
        <StatusIndicator status="pairing" />
      </Section>

      <Section title="Avatars">
        <Avatar name="Ada Lovelace" size="sm" />
        <Avatar name="Grace Hopper" size="md" />
        <Avatar name="Katherine Johnson" size="lg" />
      </Section>

      <Section title="Progress, spinner, skeleton">
        <div style={{ width: 200 }}><Progress value={64} /></div>
        <Spinner />
        <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={14} width="70%" />
          <Skeleton height={14} width="90%" />
        </div>
      </Section>

      <Section title="Empty & error states">
        <div style={{ width: 320 }}>
          <EmptyState
            icon={<ImageSquare size={32} />}
            title="No Boards yet"
            description="Create your first Board to start designing."
            action={<Button variant="primary" size="sm">Create Board</Button>}
          />
        </div>
        <div style={{ width: 360 }}>
          <ErrorBanner
            error={new ScenaApiError("BOARD_VERSION_CONFLICT", "This Board changed elsewhere.", 409, "req_abc123")}
            onRetry={() => {}}
          />
        </div>
      </Section>

      <Section title="Tooltip & menu">
        <Tooltip label="Delete this Board">
          <IconButton icon={<Trash size={18} />} label="Delete" />
        </Tooltip>
        <DropdownMenu
          trigger={<IconButton icon={<DotsThreeVertical size={18} />} label="More actions" />}
          items={[
            { key: "rename", label: "Rename" },
            { key: "duplicate", label: "Duplicate" },
            { key: "archive", label: "Archive", danger: true },
          ]}
        />
      </Section>

      <Section title="Modal, drawer, confirm">
        <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>Open confirm dialog</Button>
        <Button variant="secondary" onClick={() => toast.show("Board saved", "success")}>Show toast</Button>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Board"
        description="Choose a name and starting canvas size."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Create</Button>
          </>
        }
      >
        <Field label="Name">
          <Input placeholder="Untitled Board" />
        </Field>
      </Modal>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Board properties">
        <Field label="Opacity">
          <Input type="range" min={0} max={100} defaultValue={100} />
        </Field>
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        title="Archive this Board?"
        description="You can still find it by filtering for archived Boards."
        confirmLabel="Archive"
        danger
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />

      <Section title="Tabs">
        <div style={{ width: "100%" }}>
          <Tabs defaultValue="scenes">
            <TabList>
              <Tab value="scenes">Scenes</Tab>
              <Tab value="elements">Elements</Tab>
              <Tab value="history">Revisions</Tab>
            </TabList>
            <TabPanel value="scenes">Scene list goes here.</TabPanel>
            <TabPanel value="elements">Element list goes here.</TabPanel>
            <TabPanel value="history">Revision history goes here.</TabPanel>
          </Tabs>
        </div>
      </Section>

      <Section title="Accordion (FAQ)">
        <div style={{ width: "100%" }}>
          <Accordion
            items={[
              { key: "q1", question: "What is Scena?", answer: "Scena is a digital signage platform for Boards, Assets, and Displays." },
              { key: "q2", question: "Is there a free plan?", answer: "Yes — Personal Free includes 2 Displays and 5 Boards." },
            ]}
          />
        </div>
      </Section>

      <Section title="Data table">
        <div style={{ width: "100%" }}>
          <DataTable
            rowKey={(row) => row.id}
            columns={[
              { key: "name", header: "Display", render: (row) => row.name },
              { key: "status", header: "Status", render: (row) => <StatusIndicator status={row.status} /> },
            ]}
            rows={[
              { id: "1", name: "Front Counter", status: "ready" },
              { id: "2", name: "Drive-Thru", status: "offline" },
            ]}
          />
        </div>
      </Section>

      <Section title="Pagination">
        <Pagination page={page} totalPages={5} onChange={setPage} />
      </Section>

      <Section title="Upload dropzone">
        <div style={{ width: "100%" }}>
          <UploadDropzone onFiles={() => {}} hint="Images, PDF, and PowerPoint up to 250 MB" />
          <FileQueue
            items={[
              { key: "a", name: "menu-board.pptx", status: "processing", statusLabel: "Processing…" },
              { key: "b", name: "hero.png", status: "ready", statusLabel: "Ready" },
              { key: "c", name: "oversized.pdf", status: "failed", statusLabel: "Too large" },
            ]}
          />
        </div>
      </Section>

      <Section title="Search (large)">
        <SearchInput uiSize="lg" placeholder="Search Scena" style={{ width: 420 }} />
      </Section>
    </div>
  );
}
