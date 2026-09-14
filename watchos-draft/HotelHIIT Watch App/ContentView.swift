import SwiftUI

struct ContentView: View {
    @AppStorage("completedDate") private var completedDate = ""

    private var today: String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar.current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    private var didToday: Bool {
        completedDate == today
    }

    var body: some View {
        VStack(spacing: 16) {
            Text(didToday ? "実施済み" : "未実施")
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(didToday ? Color.green : Color.orange)
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            Button(didToday ? "取り消す" : "HIIT した") {
                completedDate = didToday ? "" : today
            }
            .buttonStyle(.borderedProminent)
            .tint(didToday ? .gray : .orange)
            .controlSize(.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background((didToday ? Color.green : Color.orange).opacity(0.18))
    }
}

#Preview {
    ContentView()
}
