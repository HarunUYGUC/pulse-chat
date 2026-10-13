using System;

namespace PulseChat.Api.Helpers;

public static class PrivacyHelper
{
    /// <summary>
    /// Masks a user's email address (e.g. "alex@example.com" -> "al***@example.com")
    /// to preserve user privacy and comply with GDPR/PII minimization rules.
    /// </summary>
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return string.Empty;

        var atIndex = email.IndexOf('@');
        if (atIndex <= 0)
            return "***";

        var name = email.Substring(0, atIndex);
        var domain = email.Substring(atIndex);
        var visibleLength = Math.Min(2, name.Length);

        return $"{name.Substring(0, visibleLength)}***{domain}";
    }
}
