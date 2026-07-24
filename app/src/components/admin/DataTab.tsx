import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert,
} from 'react-native';
import Modal from '../Modal';
import StatsCard from '../StatsCard';
import Pagination from '../Pagination';
import NumericInput from '../NumericInput';
import { submissionsApi } from '../../api/submissions';
import { fmtNgay, fmtDate, FIELD_LABELS, ROLE_LABELS } from '../../utils';
import type { Submission, User, ShippingLine, EditHistory } from '../../types';

interface Props {
  user: any;
  allUsers: User[];
  allShippingLines: ShippingLine[];
  onRefresh: () => void;
}

export default function DataTab({ user, allUsers, allShippingLines, onRefresh }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');
  const [filterSl, setFilterSl] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [page, setPage] = useState(1);

  const now = new Date();
  const [hrMonth, setHrMonth] = useState(now.getMonth() + 1);
  const [hrYear, setHrYear] = useState(now.getFullYear());

  const isHr = user?.role === 'hr';
  const showExportModal = user?.role === 'ops' || user?.role === 'admin' || user?.role === 'supper_admin';

  const pageSize = 20;
  const pagedSubmissions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return submissions.slice(start, start + pageSize);
  }, [submissions, page]);
  const totalPages = Math.max(1, Math.ceil(submissions.length / pageSize));

  const slDisplayMapById = useMemo(() => new Map(allShippingLines.map(sl => [sl.id, [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ')])), [allShippingLines]);
  const slDisplayMapByName = useMemo(() => new Map(allShippingLines.map(sl => [sl.name, [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ')])), [allShippingLines]);
  const completedSlIds = useMemo(() => new Set(allShippingLines.filter(sl => sl.completed).map(sl => sl.id)), [allShippingLines]);
  const completedSlNames = useMemo(() => new Set(allShippingLines.filter(sl => sl.completed).map(sl => sl.name)), [allShippingLines]);

  const isCompleted = (s: Submission) => s.shippingLineId ? completedSlIds.has(s.shippingLineId) : completedSlNames.has(s.shippingLine);
  const getSlDisplay = (s: Submission) => {
    if (s.shippingLineId) return slDisplayMapById.get(s.shippingLineId) || s.shippingLine;
    return slDisplayMapByName.get(s.shippingLine) || s.shippingLine;
  };

  useEffect(() => { if (!isHr) loadSubmissions(); }, [filterSl]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {};
      if (filterUser) params.user_id = filterUser;
      if (filterSl) params.shippingLineId = filterSl;
      if (filterFrom) params.from_date = filterFrom;
      if (filterTo) params.to_date = filterTo;
      const res = await submissionsApi.getAll(params);
      const d = res.data as any;
      setSubmissions(Array.isArray(d) ? d : d.data || []);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Edit submission modal
  const [editModal, setEditModal] = useState(false);
  const [editSub, setEditSub] = useState<Submission | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const openEdit = (s: Submission) => {
    setEditSub(s);
    setEditForm({ ...s });
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editSub) return;
    setSaving(true);
    try {
      await submissionsApi.updateAdmin(editSub.id, {
        shippingLine: editForm.shippingLine,
        shippingLineId: editForm.shippingLineId || undefined,
        route: editForm.route || '',
        hang20: editForm.hang20 || '',
        hang40: editForm.hang40 || '',
        vo20: editForm.vo20 || '',
        vo40: editForm.vo40 || '',
        vo20fr: editForm.vo20fr || '',
        vo40fr: editForm.vo40fr || '',
        veSinhLai: editForm.veSinhLai || '',
        keoVe: editForm.keoVe || '',
        tip: editForm.tip || '',
      });
      setEditModal(false);
      loadSubmissions();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteSub = (id: number) => {
    Alert.alert('Xác nhận', 'Bạn chắc chắn muốn XÓA bản ghi này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try { await submissionsApi.delete(id); loadSubmissions(); }
        catch (err: any) { Alert.alert('Lỗi', err.message); }
      }},
    ]);
  };

  // Delete all
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // Export
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportVendorKhac, setExportVendorKhac] = useState('');
  const [exportTenNguoiNhap, setExportTenNguoiNhap] = useState('');

  // Total Ship
  const [totalShipOpen, setTotalShipOpen] = useState(false);
  const [totalShipSlId, setTotalShipSlId] = useState<number | null>(null);
  const [totalShipForm, setTotalShipForm] = useState({
    hang20: '', hang40: '', vo20: '', vo40: '',
    vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '',
  });
  const [totalShipSaving, setTotalShipSaving] = useState(false);

  const exportExcel = async (vendorKhac?: string, tenNguoiNhap?: string) => {
    try {
      const params: Record<string, string> = {};
      if (isHr) {
        params.from_date = `${hrYear}-${String(hrMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(hrYear, hrMonth, 0).getDate();
        params.to_date = `${hrYear}-${String(hrMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        if (filterUser) params.user_id = filterUser;
        if (filterSl) params.shippingLineId = filterSl;
        if (filterFrom) params.from_date = filterFrom;
        if (filterTo) params.to_date = filterTo;
      }
      if (vendorKhac) params.vendorKhac = vendorKhac;
      if (tenNguoiNhap) params.tenNguoiNhap = tenNguoiNhap;
      await submissionsApi.exportExcel(params);
      Alert.alert('Thành công', 'Đã xuất Excel, kiểm tra thư mục tải về');
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Xuất Excel thất bại');
    }
  };

  const handleExportClick = () => {
    if (showExportModal) {
      setExportVendorKhac('');
      setExportTenNguoiNhap('');
      setExportModalOpen(true);
    } else {
      exportExcel();
    }
  };

  const openTotalShipForm = () => {
    if (!filterSl) {
      Alert.alert('Lỗi', 'Vui lòng chọn một kế hoạch trước khi nhập SL Tổng Tàu.');
      return;
    }
    const slId = Number(filterSl);
    setTotalShipSlId(slId);
    const existing = submissions.find(s => s.userId === user?.id && s.shippingLineId === slId);
    if (existing) {
      setTotalShipForm({
        hang20: existing.hang20 || '',
        hang40: existing.hang40 || '',
        vo20: existing.vo20 || '',
        vo40: existing.vo40 || '',
        vo20fr: existing.vo20fr || '',
        vo40fr: existing.vo40fr || '',
        veSinhLai: existing.veSinhLai || '',
        keoVe: existing.keoVe || '',
        tip: existing.tip || '',
      });
    } else {
      setTotalShipForm({ hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '' });
    }
    setExportModalOpen(false);
    setTimeout(() => setTotalShipOpen(true), 200);
  };

  const saveTotalShip = async () => {
    const sl = allShippingLines.find(sl => sl.id === totalShipSlId);
    if (!sl) return;
    setTotalShipSaving(true);
    try {
      const payload = {
        shippingLine: sl.name,
        shippingLineId: sl.id,
        route: sl.routeName || '',
        ...totalShipForm,
      };
      let existing = submissions.find(s => s.userId === user?.id && s.shippingLineId === totalShipSlId);
      if (!existing) {
        try {
          const mySubs = await submissionsApi.getMy();
          existing = (Array.isArray(mySubs.data) ? mySubs.data : (mySubs.data as any).data || []).find((s: any) => s.shippingLineId === totalShipSlId);
        } catch {}
      }
      if (existing) {
        await submissionsApi.update(existing.id, payload);
      } else {
        await submissionsApi.create(payload);
      }
      const params: Record<string, string> = {};
      if (filterSl) params.shippingLineId = filterSl;
      if (filterFrom) params.from_date = filterFrom;
      if (filterTo) params.to_date = filterTo;
      await submissionsApi.exportExcel(params);
      setTotalShipOpen(false);
      Alert.alert('Thành công', 'Đã lưu và xuất Excel!');
      loadSubmissions();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Thao tác thất bại');
    } finally {
      setTotalShipSaving(false);
    }
  };

  const planDisplayName = (sl: ShippingLine) =>
    [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');

  return (
    <View style={styles.container}>
      {isHr ? (
        /* ─── HR view: month/year + export ─── */
        <View style={styles.filters}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 }}>📊 Xuất lương tháng</Text>
          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Tháng</Text>
              <View style={styles.picker}>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                  const months = Array.from({ length: 12 }, (_, i) => i + 1);
                  Alert.alert('Chọn tháng', '', [
                    ...months.map(m => ({ text: `Tháng ${m}`, onPress: () => setHrMonth(m) })),
                    { text: 'Hủy', style: 'cancel' as const },
                  ]);
                }}>
                  <Text style={styles.pickerText}>Tháng {hrMonth}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Năm</Text>
              <View style={styles.picker}>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => {
                  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
                  Alert.alert('Chọn năm', '', [
                    ...years.map(y => ({ text: String(y), onPress: () => setHrYear(y) })),
                    { text: 'Hủy', style: 'cancel' as const },
                  ]);
                }}>
                  <Text style={styles.pickerText}>{hrYear}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={() => exportExcel()}>
            <Text style={styles.exportBtnText}>📥 Xuất Excel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ─── Non-HR view: filters + table ─── */
        <>
          {/* Stats */}
          <View style={styles.statsRow}>
            <StatsCard icon="📋" value={submissions.length} label="Tổng bản ghi" />
            <StatsCard icon="🚢" value={allShippingLines.length} label="Kế hoạch" />
          </View>

          {/* Filters */}
          <View style={styles.filters}>
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Người nhập</Text>
                <View style={styles.picker}>
                  <TouchableOpacity
                    style={styles.pickerBtn}
                    onPress={() => {
                      const options = [{ label: 'Tất cả', value: '' }, ...allUsers.map(u => ({ label: `${u.fullName} (${u.username})`, value: String(u.id) }))];
                      Alert.alert('Chọn người nhập', '', [
                        ...options.map(o => ({ text: o.label, onPress: () => setFilterUser(o.value) })),
                        { text: 'Hủy', style: 'cancel' as const },
                      ]);
                    }}
                  >
                    <Text style={styles.pickerText} numberOfLines={1}>
                      {filterUser ? allUsers.find(u => String(u.id) === filterUser)?.fullName || 'Đã chọn' : 'Tất cả'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Kế hoạch</Text>
                <View style={styles.picker}>
                  <TouchableOpacity
                    style={styles.pickerBtn}
                    onPress={() => {
                      const options = [{ label: 'Tất cả', value: '' }, ...allShippingLines.map(sl => ({ label: planDisplayName(sl), value: String(sl.id) }))];
                      Alert.alert('Chọn kế hoạch', '', [
                        ...options.map(o => ({ text: o.label, onPress: () => { setFilterSl(o.value); setPage(1); } })),
                        { text: 'Hủy', style: 'cancel' as const },
                      ]);
                    }}
                  >
                    <Text style={styles.pickerText} numberOfLines={1}>
                      {filterSl ? allShippingLines.find(sl => String(sl.id) === filterSl)?.name || 'Đã chọn' : 'Tất cả'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Từ ngày</Text>
                <TextInput
                  style={styles.dateInput}
                  value={filterFrom}
                  onChangeText={setFilterFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Đến ngày</Text>
                <TextInput
                  style={styles.dateInput}
                  value={filterTo}
                  onChangeText={setFilterTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterBtn} onPress={() => { setPage(1); loadSubmissions(); }}>
                <Text style={styles.filterBtnText}>🔍 Lọc</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportBtn} onPress={handleExportClick}>
                <Text style={styles.exportBtnText}>📥 Xuất Excel</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Delete All */}
          {user?.role === 'supper_admin' && submissions.length > 0 && (
            <TouchableOpacity style={styles.deleteAllBtn} onPress={() => setDeleteAllOpen(true)}>
              <Text style={styles.deleteAllBtnText}>🗑️ Xóa tất cả dữ liệu</Text>
            </TouchableOpacity>
          )}

          {/* Table */}
          <View style={styles.tableContainer}>
            {loading ? (
              <Text style={styles.emptyText}>Đang tải...</Text>
            ) : submissions.length === 0 ? (
              <Text style={styles.emptyText}>📭 Không có bản ghi nào</Text>
            ) : (
              <ScrollView horizontal>
                <View>
                  {/* Header */}
                  <View style={styles.tableHeader}>
                    {['#', 'Người nhập', 'Lái xe', 'KH', 'H20', 'H40', 'V20', 'V40', 'V20FR', 'V40FR', 'VSL', 'KV', 'TIP', 'Sửa', 'Tác vụ'].map(h => (
                      <Text key={h} style={[styles.th, h === 'KH' && { minWidth: 120 }]}>{h}</Text>
                    ))}
                  </View>
                  {/* Rows */}
                  <ScrollView style={{ maxHeight: 400 }}>
                    {pagedSubmissions.map((s, i) => (
                      <View key={s.id} style={styles.tableRow}>
                        <Text style={styles.td}>{(page - 1) * pageSize + i + 1}</Text>
                        <Text style={styles.td}>{(s as any).user?.username || '—'}</Text>
                        <Text style={styles.td}>{s.driverName}</Text>
                        <Text style={[styles.td, { minWidth: 120 }]} numberOfLines={1}>{getSlDisplay(s)}</Text>
                        <Text style={styles.td}>{s.hang20 || '—'}</Text>
                        <Text style={styles.td}>{s.hang40 || '—'}</Text>
                        <Text style={styles.td}>{s.vo20 || '—'}</Text>
                        <Text style={styles.td}>{s.vo40 || '—'}</Text>
                        <Text style={styles.td}>{s.vo20fr || '—'}</Text>
                        <Text style={styles.td}>{s.vo40fr || '—'}</Text>
                        <Text style={styles.td}>{s.veSinhLai || '—'}</Text>
                        <Text style={styles.td}>{s.keoVe || '—'}</Text>
                        <Text style={styles.td}>{s.tip || '—'}</Text>
                        <Text style={styles.td}>{s.editCount > 0 ? `✏️${s.editCount}` : '0'}</Text>
                    <View style={styles.td}>
                      {isCompleted(s) ? (
                        <Text style={styles.completedBadge}>✅</Text>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(s)}>
                            <Text style={styles.editBtnText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.delBtn} onPress={() => deleteSub(s.id)}>
                            <Text style={styles.delBtnText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Pagination page={page} totalPages={totalPages} totalItems={submissions.length} onPageChange={setPage} />
            </View>
          </ScrollView>
        )}
      </View>
      </>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModal}
        onClose={() => setEditModal(false)}
        title="✏️ Sửa bản ghi — Admin"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(false)}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={saveEdit} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Đang lưu...' : '💾 Lưu'}</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.fieldLabel}>Kế hoạch</Text>
        <ScrollView style={{ maxHeight: 150, marginBottom: 12 }}>
          {allShippingLines.map(sl => {
            const sel = editForm.shippingLineId === sl.id;
            return (
              <TouchableOpacity
                key={sl.id}
                style={[styles.planItem, sel && styles.planItemSel]}
                onPress={() => setEditForm({ ...editForm, shippingLine: sl.name, shippingLineId: sl.id })}
              >
                <View style={[styles.radio, sel && styles.radioSel]}>
                  {sel && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.planItemText} numberOfLines={2}>{planDisplayName(sl)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.divider} />
        <View style={styles.editGrid}>
          {['hang20','hang40','vo20','vo40','vo20fr','vo40fr','veSinhLai','keoVe','tip'].map(f => (
            <NumericInput
              key={f}
              label={FIELD_LABELS[f] || f}
              value={String(editForm[f] || '')}
              onChange={(v) => setEditForm({ ...editForm, [f]: v })}
            />
          ))}
        </View>
        {editSub?.history && editSub.history.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>
              📜 Lịch sử ({editSub.history.length} lần)
            </Text>
            {editSub.history.map((h: EditHistory) => (
              <HistoryRow key={h.id} history={h} />
            ))}
          </View>
        )}
      </Modal>

      {/* Delete All Modal */}
      <Modal
        visible={deleteAllOpen}
        onClose={() => { setDeleteAllOpen(false); setDeletePassword(''); }}
        title="⚠️ Xóa tất cả dữ liệu"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setDeleteAllOpen(false); setDeletePassword(''); }}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={async () => {
              if (deletePassword !== '091281') { Alert.alert('Lỗi', 'Sai mật khẩu'); return; }
              setDeleteAllOpen(false); setDeletePassword('');
              try { await submissionsApi.deleteAll(); loadSubmissions(); } catch {}
            }}>
              <Text style={styles.dangerBtnText}>🗑️ Xóa tất cả</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          Bạn có chắc muốn xóa tất cả dữ liệu? Hành động này không thể hoàn tác.
        </Text>
        <Text style={styles.fieldLabel}>Nhập mật khẩu xác nhận</Text>
        <TextInput
          style={styles.passwordInput}
          value={deletePassword}
          onChangeText={setDeletePassword}
          secureTextEntry
          placeholder="Nhập mật khẩu..."
          placeholderTextColor="#94a3b8"
        />
      </Modal>

      {/* Export Confirmation Modal */}
      <Modal
        visible={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="📋 Xác nhận xuất Excel"
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.totalShipBtn} onPress={openTotalShipForm}>
              <Text style={styles.totalShipBtnText}>📊 Tổng SL Tàu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportConfirmBtn} onPress={() => {
              setExportModalOpen(false);
              exportExcel(exportVendorKhac, exportTenNguoiNhap);
            }}>
              <Text style={styles.exportConfirmBtnText}>📥 Xuất Excel</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.fieldLabel}>Vendor khác (nếu có)</Text>
          <TextInput
            style={styles.modalInput}
            value={exportVendorKhac}
            onChangeText={setExportVendorKhac}
            placeholder="Nhập vendor khác..."
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.fieldLabel}>Tên người nhập</Text>
          <TextInput
            style={styles.modalInput}
            value={exportTenNguoiNhap}
            onChangeText={setExportTenNguoiNhap}
            placeholder="Nhập tên người nhập..."
            placeholderTextColor="#94a3b8"
          />
        </View>
      </Modal>

      {/* Total Ship Modal */}
      <Modal
        visible={totalShipOpen}
        onClose={() => setTotalShipOpen(false)}
        title="📊 Nhập SL Tổng Tàu"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setTotalShipOpen(false)}>
              <Text style={styles.cancelBtnText}>Đóng</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportConfirmBtn, totalShipSaving && { opacity: 0.5 }]} onPress={saveTotalShip} disabled={totalShipSaving}>
              <Text style={styles.exportConfirmBtnText}>{totalShipSaving ? '⏳ Đang xử lý...' : '📥 Xuất Excel'}</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <Text style={styles.fieldLabel}>Kế hoạch</Text>
        <View style={styles.totalShipPlanDisplay}>
          <Text style={{ fontSize: 12, color: '#0f172a' }}>
            {totalShipSlId ? planDisplayName(allShippingLines.find(sl => sl.id === totalShipSlId)!) : '—'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.editGrid}>
          {(['hang20','hang40','vo20','vo40','vo20fr','vo40fr','veSinhLai','keoVe','tip'] as const).map(f => (
            <NumericInput
              key={f}
              label={FIELD_LABELS[f] || f}
              value={(totalShipForm as any)[f] || ''}
              onChange={(v) => setTotalShipForm((prev) => ({ ...prev, [f]: v }))}
            />
          ))}
        </View>
      </Modal>
    </View>
  );
}

function HistoryRow({ history }: { history: EditHistory }) {
  let changes: Record<string, { old: string; new: string }> = {};
  try { changes = JSON.parse(history.changes); } catch { return null; }
  return (
    <View style={styles.historyItem}>
      <Text style={{ fontSize: 10, color: '#64748b' }}>🕐 {fmtDate(history.editedAt)} — {history.editedByName}</Text>
      {Object.entries(changes).map(([k, v]) => (
        <Text key={k} style={{ fontSize: 10, color: '#475569' }}>
          {FIELD_LABELS[k] || k}: "<Text style={{ color: '#ef4444' }}>{v.old || '(trống)'}</Text>" → "<Text style={{ color: '#10b981' }}>{v.new || '(trống)'}</Text>"
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filters: { backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  filterItem: { flex: 1 },
  filterLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  picker: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' },
  pickerBtn: { padding: 10, backgroundColor: '#fff' },
  pickerText: { fontSize: 12, color: '#0f172a' },
  dateInput: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 10, fontSize: 12, color: '#0f172a' },
  filterActions: { flexDirection: 'row', gap: 8 },
  filterBtn: { flex: 1, backgroundColor: '#1a56db', borderRadius: 8, padding: 10, alignItems: 'center' },
  filterBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  exportBtn: { flex: 1, backgroundColor: '#10b981', borderRadius: 8, padding: 10, alignItems: 'center' },
  exportBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteAllBtn: { alignSelf: 'flex-end', backgroundColor: '#ef4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 },
  deleteAllBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  tableContainer: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 4 },
  th: { minWidth: 50, paddingHorizontal: 6, fontSize: 9, fontWeight: '700', color: '#334155', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', alignItems: 'center' },
  td: { minWidth: 50, paddingHorizontal: 6, fontSize: 11, color: '#0f172a' },
  completedBadge: { fontSize: 14 },
  editBtn: { backgroundColor: '#f59e0b', borderRadius: 4, padding: 4 },
  editBtnText: { fontSize: 11 },
  delBtn: { backgroundColor: '#ef4444', borderRadius: 4, padding: 4 },
  delBtnText: { fontSize: 11, color: '#fff' },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  cancelBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1a56db' },
  saveBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  dangerBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#ef4444' },
  dangerBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  planItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, marginBottom: 4, backgroundColor: '#fff' },
  planItemSel: { borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.08)' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  radioSel: { borderColor: '#1a56db' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a56db' },
  planItemText: { fontSize: 12, color: '#0f172a', flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 12 },
  editGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyText: { textAlign: 'center', paddingVertical: 20, fontSize: 13, color: '#64748b' },
  historyItem: { backgroundColor: '#f8fafc', borderRadius: 6, padding: 8, borderLeftWidth: 3, borderLeftColor: '#f59e0b', marginBottom: 4 },
  passwordInput: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 10, fontSize: 14, color: '#0f172a' },
  exportConfirmBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#10b981' },
  exportConfirmBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  modalInput: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 10, fontSize: 13, color: '#0f172a' },
  totalShipBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f59e0b' },
  totalShipBtnText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  totalShipPlanDisplay: { padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', marginBottom: 8 },
});
